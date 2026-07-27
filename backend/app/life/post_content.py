import re
from urllib.parse import urlsplit


CONTENT_FORMATS = {"plain", "markdown"}
BODY_MAX_LENGTH = 50_000
EXTERNAL_VIDEO_URL_MAX_LENGTH = 2048
INLINE_MEDIA_TOKEN_RE = re.compile(
    r"\{\{yingmo-media:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\|[^}\r\n]{0,160})?\}\}",
    flags=re.IGNORECASE,
)


def normalize_optional_text(value, maximum):
    if value is None:
        return None
    if not isinstance(value, str):
        raise TypeError("value must be a string")
    value = value.strip()
    if len(value) > maximum:
        raise ValueError("value is too long")
    return value or None


def normalize_external_video_url(value):
    value = normalize_optional_text(value, EXTERNAL_VIDEO_URL_MAX_LENGTH)
    if value is None:
        return None
    if any(character.isspace() or ord(character) < 32 for character in value):
        raise ValueError("external video URL cannot contain whitespace")
    parsed = urlsplit(value)
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.netloc or parsed.hostname is None:
        raise ValueError("external video URL must use http or https")
    return value


def has_publishable_content(body, media_ids, external_video_url):
    return bool(
        (isinstance(body, str) and body.strip())
        or media_ids
        or external_video_url
    )


def inline_media_public_ids(body):
    if not isinstance(body, str):
        return []
    return list(dict.fromkeys(
        match.group(1).lower()
        for match in INLINE_MEDIA_TOKEN_RE.finditer(body)
    ))


def life_media_reference_error(body, cover_media_id, media_items):
    by_id = {item.id: item for item in media_items}
    by_public_id = {item.public_id.lower(): item for item in media_items}
    if cover_media_id is not None:
        cover = by_id.get(cover_media_id)
        if cover is None:
            return (
                "cover_media_id",
                "cover_not_attached",
                "封面必须来自当前内容已上传的媒体。",
            )
        if cover.media_type != "image":
            return (
                "cover_media_id",
                "invalid_cover_type",
                "封面必须是普通图片，Live Photo 可以插入正文。",
            )
    missing = [
        public_id
        for public_id in inline_media_public_ids(body)
        if public_id not in by_public_id
    ]
    if missing:
        return (
            "body",
            "inline_media_not_attached",
            "正文引用了未绑定或无权使用的站内媒体。",
        )
    return None


def content_excerpt(body, maximum=160):
    if not body:
        return ""
    text = INLINE_MEDIA_TOKEN_RE.sub(" ", body)
    text = re.sub(r"```.*?```", " ", text, flags=re.DOTALL)
    text = re.sub(r"!\[([^\]]*)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"^\s{0,3}(?:#{1,6}|>|[-+*]|\d+[.)])\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"[*_~`|]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:maximum]


def post_display_title(post, maximum=100):
    return (post.title or content_excerpt(post.body, maximum) or "无标题内容")[:maximum]
