from app.models.user import serialize_datetime


def public_user_dict(user):
    return {
        "id": user.id,
        "username": user.username,
        "nickname": user.nickname,
        "avatar_url": user.avatar_url,
        "bio": user.bio,
        "region": user.region,
        "created_at": serialize_datetime(user.created_at),
    }
