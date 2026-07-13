import re
import unicodedata


def normalize_search_query(value):
    if not isinstance(value, str): raise ValueError("搜索词必须是字符串。")
    value = re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value).strip()).casefold()
    if not value: raise ValueError("请输入搜索词。")
    if len(value) > 100: raise ValueError("搜索词最多 100 个字符。")
    visible = re.sub(r"[^\w\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]", "", value, flags=re.UNICODE)
    has_cjk = bool(re.search(r"[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]", visible))
    if len(visible) < (2 if has_cjk else 3): raise ValueError("搜索词太短。中文、日文或韩文至少 2 个字符，其他搜索词至少 3 个字符。")
    return value


def escape_like(value): return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
