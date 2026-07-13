import re
import unicodedata


def normalize_search_query(value):
    if not isinstance(value, str):
        raise ValueError("搜索词必须是字符串。")
    value = re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value).strip()).casefold()
    if not value:
        raise ValueError("请输入搜索词。")
    if len(value) > 100:
        raise ValueError("搜索词最多 100 个字符。")
    return value


def escape_like(value):
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
