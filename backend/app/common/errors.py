from werkzeug.exceptions import HTTPException

from .responses import error_response


HTTP_ERROR_CODES = {
    400: ("BAD_REQUEST", "请求无法处理。"),
    404: ("RESOURCE_NOT_FOUND", "请求的资源不存在。"),
    405: ("METHOD_NOT_ALLOWED", "请求方法不被允许。"),
    413: ("PAYLOAD_TOO_LARGE", "请求内容超过允许大小。"),
}


def register_error_handlers(app):
    @app.errorhandler(HTTPException)
    def handle_http_error(error):
        if not _is_api_request():
            return error

        code, message = HTTP_ERROR_CODES.get(
            error.code,
            ("HTTP_ERROR", "请求无法处理。"),
        )
        return error_response(code, message, error.code)

    @app.errorhandler(Exception)
    def handle_unexpected_error(error):
        app.logger.exception("Unhandled API exception", exc_info=error)
        if not _is_api_request():
            raise error
        return error_response("INTERNAL_ERROR", "服务器暂时无法处理请求。", 500)


def _is_api_request():
    from flask import request

    return request.path.startswith("/api/")
