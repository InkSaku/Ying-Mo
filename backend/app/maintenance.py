"""Safe, opt-in maintenance commands.  They never run during application startup."""
from datetime import timedelta
import click
from flask import current_app
from flask.cli import with_appcontext

from app.auth.service import utcnow
from app.extensions import db
from app.models import Media
from app.uploads.storage import file_exists, remove_media_files, upload_root


def register_commands(app):
    app.cli.add_command(maintenance)


@click.group()
def maintenance():
    """Read-only audits and explicitly requested cleanup tasks."""


@maintenance.command("audit-media")
@with_appcontext
def audit_media():
    """Report missing media files and database-external orphan files without changing data."""
    media = db.session.scalars(db.select(Media)).all()
    missing = [item.id for item in media if not file_exists(item.storage_key) or not file_exists(item.thumbnail_key)]
    known = {item.storage_key for item in media} | {item.thumbnail_key for item in media}
    root = upload_root()
    orphan_files = [path for path in root.rglob("*") if path.is_file() and str(path.relative_to(root)) not in known]
    unbound = [item.id for item in media if not item.is_bound]
    click.echo(f"media_total={len(media)} missing_files={len(missing)} unbound={len(unbound)} orphan_files={len(orphan_files)}")
    if missing:
        click.echo("missing_media_ids=" + ",".join(map(str, missing)))


@maintenance.command("cleanup-unbound-media")
@click.option("--older-than-hours", type=click.IntRange(min=1), default=24, show_default=True)
@click.option("--batch-size", type=click.IntRange(min=1, max=1000), default=100, show_default=True)
@click.option("--max-items", type=click.IntRange(min=1, max=10000), default=1000, show_default=True)
@click.option("--apply", "apply_changes", is_flag=True, help="Actually remove records and files; otherwise only report candidates.")
@with_appcontext
def cleanup_unbound_media(older_than_hours, batch_size, max_items, apply_changes):
    """Remove only old, unbound uploads. Default mode is intentionally dry-run."""
    cutoff = utcnow() - timedelta(hours=older_than_hours)
    stmt = db.select(Media.id).where(Media.bound_type.is_(None), Media.created_at < cutoff).order_by(Media.created_at, Media.id).limit(max_items)
    candidate_ids = list(db.session.scalars(stmt))
    click.echo(f"candidates={len(candidate_ids)} mode={'apply' if apply_changes else 'dry-run'} batch_size={batch_size}")
    if not apply_changes:
        return
    removed = skipped = failed = 0
    for start in range(0, len(candidate_ids), batch_size):
        for media_id in candidate_ids[start:start + batch_size]:
            item = db.session.scalar(db.select(Media).where(Media.id == media_id).with_for_update())
            if not item or item.is_bound or item.created_at >= cutoff:
                skipped += 1
                continue
            try:
                if not remove_media_files(item):
                    failed += 1
                    db.session.rollback()
                    continue
                db.session.delete(item)
                db.session.commit()
                removed += 1
            except Exception:
                db.session.rollback()
                failed += 1
                current_app.logger.exception("Unable to clean unbound media %s", media_id)
    click.echo(f"removed={removed} skipped={skipped} failed={failed}")
