from app.extensions import db
from app.models import Notification
from app.models.content_like import utcnow
from app.interactions.targets import target_summary


def create_like_notification(info, actor):
    if info.author_id == actor.id: return
    key = f"like:{info.author_id}:{actor.id}:{info.target_type}:{info.target.id}"
    item = db.session.scalar(db.select(Notification).where(Notification.dedupe_key == key))
    payload = target_summary(info)
    if item:
        item.created_at = utcnow(); item.read_at = None; item.payload = payload
    else:
        db.session.add(Notification(recipient_id=info.author_id, actor_id=actor.id, notification_type="like", target_type=info.target_type, target_id=info.target.id, dedupe_key=key, payload=payload))


def delete_like_notification(info, actor):
    key = f"like:{info.author_id}:{actor.id}:{info.target_type}:{info.target.id}"
    db.session.execute(db.delete(Notification).where(Notification.dedupe_key == key))


def create_comment_notification(info, comment, actor, reply=False):
    recipient = comment.reply_to_user_id if reply else info.author_id
    if not recipient or recipient == actor.id: return
    kind = "reply" if reply else "comment"
    payload = {**target_summary(info), "comment_excerpt": comment.body[:100]}
    db.session.add(Notification(recipient_id=recipient, actor_id=actor.id, notification_type=kind, target_type=info.target_type, target_id=info.target.id, comment_id=comment.id, dedupe_key=f"{kind}:{comment.id}", payload=payload))

