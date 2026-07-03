"""
自定义异常
"""
from fastapi import HTTPException, status


class AppException(HTTPException):
    def __init__(self, status_code: int, code: str, message: str, details: Optional[list[dict]] = None):
        super().__init__(status_code=status_code, detail={"code": code, "message": message, "details": details})


class NotFoundError(AppException):
    def __init__(self, resource: str):
        super().__init__(status.HTTP_404_NOT_FOUND, "NOT_FOUND", f"{resource} not found")


class ConflictError(AppException):
    def __init__(self, message: str):
        super().__init__(status.HTTP_409_CONFLICT, "CONFLICT", message)


class ValidationError(AppException):
    def __init__(self, details: list[dict]):
        super().__init__(status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", "Validation failed", details)


class UnauthorizedError(AppException):
    def __init__(self):
        super().__init__(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "Not authenticated")
