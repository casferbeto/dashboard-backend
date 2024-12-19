const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const csv = require('csv-parser');
const bcrypt = require('bcryptjs'); // Para encriptar contraseñas en el futuro
const jwt = require('jsonwebtoken'); // Para generar tokens de sesión
require('dotenv').config();

// Crear una instancia de Express
const app = express();
const PORT = 5001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

app.get('/', (req, res) => {
	res.send('Backend is working!');
});

console.log('Conexión DB:', {
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
	port: process.env.DB_PORT,
});

// Configuración de la base de datos usando .env
const db = mysql.createConnection({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
	port: process.env.DB_PORT,
});

// Conexión a la base de datos
db.connect((err) => {
	if (err) {
		console.error('Error connecting to the database:', err);
		return;
	}
	console.log('Connected to the MySQL database.');
});

// Configurar multer para manejar archivos
const upload = multer({ dest: 'uploads/' }); // Carpeta temporal para guardar los archivos

// Ruta para cargar y procesar el archivo CSV con sobrescritura de datos
app.post(
	'/api/upload-sell-in-rivera',
	upload.single('file'),
	async (req, res) => {
		try {
			// Verificar si se subió el archivo
			if (!req.file) {
				console.log('No se subió ningún archivo.');
				return res.status(400).json({ message: 'No se subió ningún archivo.' });
			}

			const results = [];
			const filePath = req.file.path;

			console.log('Archivo recibido:', filePath); // Log para verificar el archivo recibido

			// Leer y procesar el archivo CSV
			fs.createReadStream(filePath)
				.pipe(csv())
				.on('data', (data) => {
					console.log('Fila procesada del CSV:', data); // Log para cada fila del archivo CSV
					results.push(data);
				})
				.on('end', async () => {
					console.log('Datos procesados del CSV:', results); // Log de todos los datos procesados

					try {
						// Paso 1: Vaciar la tabla sell_in_rivera
						await db.promise().query('TRUNCATE TABLE sell_in_rivera');

						// Paso 2: Insertar los nuevos datos
						for (const row of results) {
							console.log('Insertando fila en la base de datos:', row); // Log de cada fila que se intenta insertar

							// Ajusta los nombres de las columnas según tu tabla sell_in_rivera
							const {
								Folio,
								'Fecha Ord.': FechaOrd,
								Suc,
								Nombre,
								Clave,
								Producto,
								Presentacion,
								'Cant. Ord.': CantOrd,
								'Cant. Pend.': CantPend,
								'Cant. Surt.': CantSurt,
								'Fill Rate': FillRate,
								'Sell In Pzas': SellInPzas,
								'Pedido SAP': PedidoSAP,
								Estatus,
							} = row;

							await db.promise().query(
								`INSERT INTO sell_in_rivera (
								Folio,
								\`Fecha Ord.\`,
								Suc,
								Nombre,
								Clave,
								Producto,
								Presentacion,
								\`Cant. Ord.\`,
								\`Cant. Pend.\`,
								\`Cant. Surt.\`,
								\`Fill Rate\`,
								\`Sell In Pzas\`,
								\`Pedido SAP\`,
								\`Estatus\`
							) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
								[
									Folio,
									FechaOrd,
									Suc,
									Nombre,
									Clave,
									Producto,
									Presentacion,
									CantOrd,
									CantPend,
									CantSurt,
									FillRate,
									SellInPzas,
									PedidoSAP || '', // Asegurarse de que no sea undefined
									Estatus || '', // Asegurarse de que no sea undefined
								],
							);
						}

						// Elimina el archivo temporal
						console.log(
							'Archivo procesado correctamente. Eliminando archivo temporal...',
						);
						fs.unlinkSync(filePath);

						res
							.status(200)
							.json({ message: 'Datos sobrescritos correctamente.' });
					} catch (error) {
						console.error(
							'Error al insertar datos en la base de datos:',
							error,
						); // Log para errores en la base de datos
						fs.unlinkSync(filePath); // Elimina el archivo temporal en caso de error
						res
							.status(500)
							.json({ message: 'Error al procesar los datos.', error });
					}
				});
		} catch (error) {
			console.error(
				'Error general en la ruta /api/upload-sell-in-rivera:',
				error,
			); // Log para errores generales
			res.status(500).json({ message: 'Error al subir el archivo.', error });
		}
	},
);

//ruta para cargar archivo csv de sell_in_cash
// Ruta para cargar y actualizar sell_in_cash
app.post('/api/upload-sell-in-cash', upload.single('file'), (req, res) => {
	if (!req.file) {
		return res.status(400).json({ message: 'No se subió ningún archivo.' });
	}

	const filePath = req.file.path;
	const results = [];

	// Leer el archivo CSV
	fs.createReadStream(filePath)
		.pipe(csv())
		.on('data', (row) => {
			results.push(row);
		})
		.on('end', async () => {
			try {
				// Vaciar la tabla actual
				await db.promise().query('TRUNCATE TABLE sell_in_cash');

				// Insertar nuevos datos
				for (const row of results) {
					const {
						Ano,
						Mes,
						Clave,
						Descripcion,
						CompraCaja,
						VentaCaja,
						CompraMXN,
						VentaMXN,
						CompraPiezas,
						VentaPiezas,
					} = row;

					await db.promise().query(
						`INSERT INTO sell_in_cash (
													Ano, Mes, Clave, Descripcion, 
													CompraCaja, VentaCaja, CompraMXN, 
													VentaMXN, CompraPiezas, VentaPiezas
											) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
						[
							Ano,
							Mes,
							Clave,
							Descripcion,
							CompraCaja,
							VentaCaja,
							CompraMXN,
							VentaMXN,
							CompraPiezas,
							VentaPiezas,
						],
					);
				}

				// Eliminar archivo temporal
				fs.unlinkSync(filePath);

				res.status(200).json({
					message: 'Datos de sell_in_cash actualizados exitosamente.',
				});
			} catch (error) {
				console.error('Error al actualizar la tabla sell_in_cash:', error);
				fs.unlinkSync(filePath);
				res.status(500).json({ message: 'Error al actualizar los datos.' });
			}
		});
});

// Rutas restantes (sin cambios)

// Ruta para obtener todos los datos de sell_in
app.get('/api/sell-in', (req, res) => {
	const query = 'SELECT * FROM sell_in ORDER BY year, month';
	db.query(query, (err, results) => {
		if (err) {
			console.error('Error fetching sell_in data:', err);
			res.status(500).json({ error: 'Error fetching data' });
		} else {
			res.json(results);
		}
	});
});

// Nueva ruta para obtener datos de la vista vista_sell_in_rivera
app.get('/api/sell-in-rivera', (req, res) => {
	const { fechaInicial, fechaFinal } = req.query;

	if (!fechaInicial || !fechaFinal) {
		return res
			.status(400)
			.json({ error: 'Fecha inicial y final son requeridas' });
	}

	const query = `
			SELECT * 
			FROM vista_sell_in_rivera
			WHERE STR_TO_DATE(\`Fecha Ord.\`, '%d/%m/%Y') BETWEEN ? AND ?
			ORDER BY \`Fecha Ord.\`, Folio
	`;

	db.query(query, [fechaInicial, fechaFinal], (err, results) => {
		if (err) {
			console.error('Error fetching vista_sell_in_rivera data:', err);
			res.status(500).json({ error: 'Error fetching data' });
		} else {
			res.json(results);
		}
	});
});

// Ruta para actualizar o insertar datos en "pedidos"
app.put('/api/pedidos', (req, res) => {
	const {
		year,
		month,
		total_pedido,
		facturado,
		pendiente_cita,
		pendiente_sin_cita,
	} = req.body;

	if (!year || !month) {
		return res.status(400).json({ error: 'Year and month are required' });
	}

	const query = `
        INSERT INTO pedidos (year, month, total_pedido, facturado, pendiente_cita, pendiente_sin_cita)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            total_pedido = IFNULL(VALUES(total_pedido), total_pedido),
            facturado = IFNULL(VALUES(facturado), facturado),
            pendiente_cita = IFNULL(VALUES(pendiente_cita), pendiente_cita),
            pendiente_sin_cita = IFNULL(VALUES(pendiente_sin_cita), pendiente_sin_cita)
    `;

	const params = [
		year,
		month,
		total_pedido || null,
		facturado || null,
		pendiente_cita || null,
		pendiente_sin_cita || null,
	];

	db.query(query, params, (err, results) => {
		if (err) {
			console.error('Error updating pedidos:', err);
			return res.status(500).json({ error: 'Error updating data' });
		}
		res.json({ message: 'Data updated successfully.' });
	});
});

// Ruta para obtener todos los datos de "pedidos"
app.get('/api/pedidos', (req, res) => {
	const query = 'SELECT * FROM pedidos ORDER BY year, month';

	db.query(query, (err, results) => {
		if (err) {
			console.error('Error fetching pedidos data:', err);
			res.status(500).json({ error: 'Error fetching data' });
		} else {
			res.json(results);
		}
	});
});

// Ruta para actualizar o insertar datos en "sell_in"
app.put('/api/sell-in', (req, res) => {
	const { year, month, value, meta } = req.body;

	console.log('Request body:', req.body); // Log para inspeccionar los datos enviados

	if (!year || !month || (value === undefined && meta === undefined)) {
		console.error('Invalid input data:', req.body);
		return res
			.status(400)
			.json({ error: 'Year, month, and either value or meta are required' });
	}

	const query = `
        INSERT INTO sell_in (year, month, value, meta)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            value = COALESCE(VALUES(value), value),
            meta = COALESCE(VALUES(meta), meta)
    `;

	const params = [
		year,
		month,
		value !== undefined ? value : 0, // Asigna 0 si value es undefined
		meta !== undefined ? meta : null,
	];

	db.query(query, params, (err, results) => {
		if (err) {
			console.error('SQL Error:', err); // Log para inspeccionar errores SQL
			return res.status(500).json({ error: 'Error updating sell_in data' });
		}
		res.json({ message: 'Sell-in data updated successfully.' });
	});
});

// Ruta para la card de fill rate de sell_in_rivera
app.get('/api/sell-in-rivera', (req, res) => {
	const { fechaInicial, fechaFinal } = req.query;

	if (!fechaInicial || !fechaFinal) {
		return res
			.status(400)
			.json({ error: 'Fecha inicial y final son requeridas' });
	}

	const query = `
        SELECT *
        FROM sell_in_rivera
        WHERE STR_TO_DATE(\`Fecha Ord.\`, '%d/%m/%Y') BETWEEN ? AND ?
    `;

	db.query(query, [fechaInicial, fechaFinal], (err, results) => {
		if (err) {
			console.error('Error fetching sell_in_rivera data:', err);
			return res.status(500).json({ error: 'Error fetching data' });
		}
		res.json(results);
	});
});

// Ruta para cargar y procesar el archivo CSV para la tabla sell_in
app.post('/api/upload-sell-in', upload.single('file'), async (req, res) => {
	try {
		// Verificar si se subió el archivo
		if (!req.file) {
			console.log('No se subió ningún archivo.');
			return res.status(400).json({ message: 'No se subió ningún archivo.' });
		}

		const results = [];
		const filePath = req.file.path;

		console.log('Archivo recibido para sell_in:', filePath); // Log para verificar el archivo recibido

		// Leer y procesar el archivo CSV
		// Procesar y validar cada fila del archivo CSV
		fs.createReadStream(filePath)
			.pipe(csv())
			.on('data', (data) => {
				// Mapea columnas y convierte meses de texto a números
				const monthMap = {
					Enero: 1,
					Febrero: 2,
					Marzo: 3,
					Abril: 4,
					Mayo: 5,
					Junio: 6,
					Julio: 7,
					Agosto: 8,
					Septiembre: 9,
					Octubre: 10,
					Noviembre: 11,
					Diciembre: 12,
				};

				const year = parseInt(data.Ano);
				const month = monthMap[data.Mes.trim()] || null; // Convierte el mes a número
				const value = parseInt(data.CompraPiezas || 0); // Usa CompraPiezas para value
				const meta = parseInt(data.VentaPiezas || 0); // Usa VentaPiezas para meta

				if (!year || !month) {
					console.warn('Fila inválida encontrada y omitida:', data);
					return; // Omite esta fila
				}

				results.push({ year, month, value, meta });
			})
			.on('end', async () => {
				try {
					// Eliminar registros existentes en la tabla antes de insertar los nuevos
					await db.promise().query('DELETE FROM sell_in');

					// Insertar los datos procesados
					for (const row of results) {
						await db.promise().query(
							`INSERT INTO sell_in (year, month, value, meta)
				 VALUES (?, ?, ?, ?)
				 ON DUPLICATE KEY UPDATE
					 value = VALUES(value),
					 meta = VALUES(meta)`,
							[row.year, row.month, row.value, row.meta],
						);
					}

					// Elimina el archivo temporal
					fs.unlinkSync(filePath);
					res
						.status(200)
						.json({ message: 'Datos actualizados correctamente.' });
				} catch (error) {
					console.error('Error al insertar datos en sell_in:', error);
					fs.unlinkSync(filePath); // Eliminar archivo temporal si ocurre un error
					res
						.status(500)
						.json({ message: 'Error al procesar los datos.', error });
				}
			});
	} catch (error) {
		console.error('Error general en la ruta /api/upload-sell-in:', error); // Log para errores generales
		res.status(500).json({ message: 'Error al subir el archivo.', error });
	}
});

//ruta de login
app.post('/api/login', async (req, res) => {
	const { username, password } = req.body;

	console.log('Credenciales recibidas del cliente:', { username, password });

	if (!username || !password) {
		return res
			.status(400)
			.json({ error: 'Username y password son requeridos.' });
	}

	try {
		// Buscar usuario en la base de datos
		const [users] = await db
			.promise()
			.query('SELECT * FROM usuarios WHERE username = ?', [username]);

		console.log('Resultados de la consulta en la base de datos:', users);

		if (!users || users.length === 0) {
			return res
				.status(401)
				.json({ error: 'Usuario o contraseña incorrectos.' });
		}

		const foundUser = users[0];

		// Comparar contraseñas directamente (sin encriptación)
		console.log(
			'Comparando contraseña ingresada:',
			password,
			'con contraseña almacenada:',
			foundUser.password,
		);
		if (password !== foundUser.password) {
			return res
				.status(401)
				.json({ error: 'Usuario o contraseña incorrectos.' });
		}

		// Responder con el rol del usuario
		res.status(200).json({
			message: 'Inicio de sesión exitoso.',
			role: foundUser.role, // Devuelve el rol: "admin" o "user"
		});
	} catch (error) {
		console.error('Error en la ruta de login:', error);
		res
			.status(500)
			.json({ error: 'Error al procesar la solicitud de inicio de sesión.' });
	}
});

// Ruta para obtener todos los datos de sell_in_cash con filtros opcionales por año y mes
app.get('/api/sell-in-cash', (req, res) => {
	const { year, month, accumulate } = req.query;

	const months = [
		'Enero',
		'Febrero',
		'Marzo',
		'Abril',
		'Mayo',
		'Junio',
		'Julio',
		'Agosto',
		'Septiembre',
		'Octubre',
		'Noviembre',
		'Diciembre',
	];

	const params = [];
	let query = '';

	if (accumulate === 'true' && year && month) {
		// Consulta para acumulado desde enero hasta el mes actual
		const monthIndex = months.indexOf(month) + 1;

		if (monthIndex === 0) {
			return res.status(400).json({ error: 'Invalid month name' });
		}

		query = `
					SELECT 
							SUM(VentaMXN) AS totalVentaMXN,
							SUM(CompraMXN) AS totalCompraMXN,
							SUM(CompraCaja) AS totalCompraCaja,
							SUM(VentaCaja) AS totalVentaCaja,
							SUM(CompraPiezas) AS totalCompraPiezas,
							SUM(VentaPiezas) AS totalVentaPiezas
					FROM sell_in_cash
					WHERE Ano = ? 
						AND FIELD(Mes, ${months.map(() => '?').join(', ')}) BETWEEN 1 AND ?
			`;
		params.push(year, ...months, monthIndex);
	} else if (year && month) {
		// Consulta para obtener solo los datos del mes actual
		query = `
					SELECT *
					FROM sell_in_cash
					WHERE Ano = ? AND Mes = ?
					ORDER BY FIELD(Mes, ${months.map(() => '?').join(', ')})
			`;
		params.push(year, month, ...months);
	} else {
		// Consulta base si no se envían parámetros
		query = `
					SELECT *
					FROM sell_in_cash
					ORDER BY Ano, FIELD(Mes, ${months.map(() => '?').join(', ')})
			`;
		params.push(...months);
	}

	db.query(query, params, (err, results) => {
		if (err) {
			console.error('Error fetching sell_in_cash data:', err);
			return res.status(500).json({ error: 'Database error' });
		}

		if (accumulate === 'true') {
			res.json({
				totals: results[0] || {
					totalVentaMXN: 0,
					totalCompraMXN: 0,
					totalCompraCaja: 0,
					totalVentaCaja: 0,
					totalCompraPiezas: 0,
					totalVentaPiezas: 0,
				},
			});
		} else {
			res.json(results);
		}
	});
});

// Nueva ruta para obtener valores acumulados de sell_in_cash
app.get('/api/sell-in-cash-accumulated', (req, res) => {
	const { year, month } = req.query;

	if (!year || !month) {
		return res.status(400).json({
			error: 'Se requiere el año y el mes para la consulta acumulada.',
		});
	}

	// Lista ordenada de meses normalizados
	const months = [
		'enero',
		'febrero',
		'marzo',
		'abril',
		'mayo',
		'junio',
		'julio',
		'agosto',
		'septiembre',
		'octubre',
		'noviembre',
		'diciembre',
	];

	// Normalizar el mes de entrada
	const normalizedMonth = month.trim().toLowerCase();

	// Obtener el índice del mes
	const monthIndex = months.indexOf(normalizedMonth) + 1;

	if (monthIndex === 0) {
		return res.status(400).json({ error: 'Nombre del mes inválido.' });
	}

	// Consulta SQL para obtener los valores acumulados
	const query = `
			SELECT 
					SUM(VentaMXN) AS totalVentaMXN,
					SUM(CompraMXN) AS totalCompraMXN,
					SUM(CompraCaja) AS totalCompraCaja,
					SUM(VentaCaja) AS totalVentaCaja,
					SUM(CompraPiezas) AS totalCompraPiezas,
					SUM(VentaPiezas) AS totalVentaPiezas
			FROM sell_in_cash
			WHERE Ano = ?
			AND FIELD(LOWER(TRIM(Mes)), ${months.map(() => '?').join(', ')}) BETWEEN 1 AND ?
	`;

	// Parámetros para la consulta
	const params = [year, ...months, monthIndex];

	db.query(query, params, (err, results) => {
		if (err) {
			console.error('Error en la consulta acumulada:', err);
			return res
				.status(500)
				.json({ error: 'Error al obtener los datos acumulados.' });
		}

		res.json({
			totals: results[0] || {
				totalVentaMXN: 0,
				totalCompraMXN: 0,
				totalCompraCaja: 0,
				totalVentaCaja: 0,
				totalCompraPiezas: 0,
				totalVentaPiezas: 0,
			},
		});
	});
});

// nueva ruta de sell_in_cash
app.get('/api/compra-piezas-by-year', (req, res) => {
	const years = [2023, 2024, 2025];
	const months = [
		'Enero',
		'Febrero',
		'Marzo',
		'Abril',
		'Mayo',
		'Junio',
		'Julio',
		'Agosto',
		'Septiembre',
		'Octubre',
		'Noviembre',
		'Diciembre',
	];

	const queries = years.map((year) => {
		return new Promise((resolve, reject) => {
			const query = `
				SELECT Mes, SUM(DISTINCT CompraPiezas) AS total
				FROM sell_in_cash
				WHERE Ano = ?
				GROUP BY Mes
				ORDER BY FIELD(Mes, ${months.map(() => '?').join(', ')})
			`;
			const params = [year, ...months];
			db.query(query, params, (err, results) => {
				if (err) reject(err);

				// Mapear los resultados para asegurar 0 en meses sin datos
				const monthlyData = months.map((month) => {
					const row = results.find((r) => r.Mes.trim() === month);
					return row ? parseInt(row.total) : 0;
				});
				resolve({ year, data: monthlyData });
			});
		});
	});

	Promise.all(queries)
		.then((results) => {
			const response = {
				months,
				data2023: results.find((r) => r.year === 2023).data,
				data2024: results.find((r) => r.year === 2024).data,
				data2025: results.find((r) => r.year === 2025).data,
			};
			res.json(response);
		})
		.catch((err) => {
			console.error('Error fetching CompraPiezas data:', err);
			res.status(500).json({ error: 'Error fetching data' });
		});
});

// Iniciar servidor
app.listen(PORT, () => {
	console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
