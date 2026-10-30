// Оборачивает асинхронный обработчик маршрута, перехватывая исключения
// и передавая их в централизованный обработчик ошибок Express (server.js).
// Это и есть "стратегия централизованной обработки исключений" из лаб. 3/4.
module.exports = function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
