from app.extensions import db
from app.models import Comment, UserRole
from app.models.user import serialize_datetime
from app.users.service import public_user_dict


def can_delete(comment, user): return bool(user and (user.id == comment.author_id or user.role in {UserRole.CONTENT_ADMIN.value, UserRole.SYSTEM_ADMIN.value}))
def comment_dict(item, user=None, reply_count=0, replies=None):
    return {"id": item.id, "target_type": item.target_type, "target_id": item.target_id, "author": public_user_dict(item.author), "body": item.body if item.status == "active" else None, "is_deleted": item.status == "deleted", "is_reply": item.parent_id is not None, "parent_id": item.parent_id, "reply_to_comment_id": item.reply_to_comment_id, "reply_to_user": public_user_dict(item.reply_to_user) if item.reply_to_user else None, "created_at": serialize_datetime(item.created_at), "updated_at": serialize_datetime(item.updated_at), "can_delete": can_delete(item, user), "reply_count": reply_count, "replies": replies or []}
def validate_body(value):
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > 500: raise ValueError
    return value.strip()
