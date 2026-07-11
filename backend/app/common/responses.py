from flask import g, jsonify


def success_response(data, status_code=200, meta=None):
    response_meta = {"request_id": g.request_id}
    if meta:
        response_meta.update(meta)
    return jsonify({"data": data, "meta": response_meta}), status_code


def error_response(code, message, status_code, details=None):
    return jsonify(
        {
            "error": {
                "code": code,
                "message": message,
                "details": details or [],
                "request_id": g.request_id,
            }
        }
    ), status_code
