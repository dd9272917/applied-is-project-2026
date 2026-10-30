// Управляемая ошибка приложения: status — HTTP-код, message — сообщение,
// которое безопасно показать пользователю (без деталей SQL/стека).
class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.publicMessage = message;
  }
}
module.exports = AppError;
