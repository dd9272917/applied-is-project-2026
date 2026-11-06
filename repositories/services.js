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
    async list(filters = {}) {
      const query = await request(), where = [];
      if (filters.search !== undefined) {
        const literal = filters.search.replace(/[~%_\[]/g, char => '~' + char);
        query.input('search', sql.NVarChar(302), '%' + literal + '%');
        where.push("Название LIKE @search ESCAPE N'~'");
      }
      if (filters.type !== undefined) {
        query.input('type', sql.NVarChar(50), filters.type);
        where.push('Тип=@type');
      }
      for (const [key, operator] of [['min_price', '>='], ['max_price', '<=']]) {
        if (filters[key] !== undefined) {
          query.input(key, sql.Decimal(10, 2), filters[key]);
          where.push(`Цена ${operator} @${key}`);
        }
      }
      return (await query.query(`SELECT ${fields} FROM Услуга
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY Тип, Название`)).recordset;
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
    async patch(id, changes) {
      // Имена столбцов берутся только из списка кода, а значения — из параметров.
      const columns = ['Название', 'Тип', 'Цена'].filter(key => Object.hasOwn(changes, key));
      if (!columns.length) throw new Error('No fields supplied for patch');
      const query = (await request()).input('id', sql.Int, id);
      const types = { Название: sql.NVarChar(150), Тип: sql.NVarChar(50), Цена: sql.Decimal(10, 2) };
      for (const key of columns) query.input(key, types[key], changes[key]);
      return (await query.query(`UPDATE Услуга SET ${columns.map(key => `[${key}]=@${key}`).join(', ')}
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
