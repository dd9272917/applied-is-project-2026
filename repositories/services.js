// Зависимости передаются извне; HTTP-обработчики не выполняют SQL напрямую.
function createServicesRepository({ getPool, sql }) {
  const fields = 'ID_Услуги, Название, Тип, Цена';
  async function request() { return (await getPool()).request(); }
  function values(query, service) {
    return query.input('Название', sql.NVarChar(150), service.Название)
      .input('Тип', sql.NVarChar(50), service.Тип)
      .input('Цена', sql.Decimal(10, 2), service.Цена);
  }
  return {
    async list() {
      return (await (await request()).query(`SELECT ${fields} FROM Услуга ORDER BY Тип, Название`)).recordset;
    },
    async findById(id) {
      return (await (await request()).input('id', sql.Int, id)
        .query(`SELECT ${fields} FROM Услуга WHERE ID_Услуги=@id`)).recordset[0];
    },
    async create(service) {
      return (await values(await request(), service).query(`INSERT INTO Услуга (Название, Тип, Цена)
        OUTPUT INSERTED.* VALUES (@Название, @Тип, @Цена)`)).recordset[0];
    },
    async update(id, service) {
      return (await values(await request(), service).input('id', sql.Int, id)
        .query(`UPDATE Услуга SET Название=@Название, Тип=@Тип, Цена=@Цена
          OUTPUT INSERTED.* WHERE ID_Услуги=@id`)).recordset[0];
    },
    async remove(id) {
      const result = await (await request()).input('id', sql.Int, id)
        .query('DELETE FROM Услуга WHERE ID_Услуги=@id');
      return result.rowsAffected[0] > 0;
    }
  };
}
module.exports = { createServicesRepository };
