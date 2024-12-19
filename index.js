const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const csv = require('csv-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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

// Configuración de la base de datos usando .env
const db = mysql.createPool({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
	port: process.env.DB_PORT,
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0,
});

console.log('Conexión DB:', {
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
	port: process.env.DB_PORT,
});

// Configurar multer para manejar archivos
const upload = multer({ dest: 'uploads/' });

// Ruta para el login
app.post('/api/login', async (req, res) => {
	const { username, password } = req.body;

	try {
		const [users] = await db.execute(
			'SELECT * FROM usuarios WHERE username = ?',
			[username],
		);

		if (!users || users.length === 0) {
			return res
				.status(401)
				.json({ error: 'Usuario o contraseña incorrectos.' });
		}

		const foundUser = users[0];

		if (password !== foundUser.password) {
			return res
				.status(401)
				.json({ error: 'Usuario o contraseña incorrectos.' });
		}

		res.status(200).json({
			message: 'Inicio de sesión exitoso.',
			role: foundUser.role,
		});
	} catch (error) {
		console.error('Error en la ruta de login:', error);
		res
			.status(500)
			.json({ error: 'Error al procesar la solicitud de inicio de sesión.' });
	}
});

// Ruta para obtener todos los datos de "sell_in"
app.get('/api/sell-in', async (req, res) => {
	try {
		const [results] = await db.execute(
			'SELECT * FROM sell_in ORDER BY year, month',
		);
		res.json(results);
	} catch (error) {
		console.error('Error fetching sell_in data:', error);
		res.status(500).json({ error: 'Error fetching data' });
	}
});

// Ruta para subir y procesar un archivo CSV para "sell_in"
app.post('/api/upload-sell-in', upload.single('file'), async (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({ message: 'No se subió ningún archivo.' });
		}

		const filePath = req.file.path;
		const results = [];

		fs.createReadStream(filePath)
			.pipe(csv())
			.on('data', (data) => {
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
				const month = monthMap[data.Mes.trim()] || null;
				const value = parseInt(data.CompraPiezas || 0);
				const meta = parseInt(data.VentaPiezas || 0);

				if (year && month) {
					results.push({ year, month, value, meta });
				}
			})
			.on('end', async () => {
				try {
					await db.execute('DELETE FROM sell_in');

					for (const row of results) {
						await db.execute(
							`INSERT INTO sell_in (year, month, value, meta)
                             VALUES (?, ?, ?, ?)
                             ON DUPLICATE KEY UPDATE
                             value = VALUES(value),
                             meta = VALUES(meta)`,
							[row.year, row.month, row.value, row.meta],
						);
					}

					fs.unlinkSync(filePath);
					res
						.status(200)
						.json({ message: 'Datos actualizados correctamente.' });
				} catch (error) {
					console.error('Error al insertar datos en sell_in:', error);
					fs.unlinkSync(filePath);
					res
						.status(500)
						.json({ message: 'Error al procesar los datos.', error });
				}
			});
	} catch (error) {
		console.error('Error general en la ruta /api/upload-sell-in:', error);
		res.status(500).json({ message: 'Error al subir el archivo.', error });
	}
});

// Iniciar servidor
app.listen(PORT, () => {
	console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
