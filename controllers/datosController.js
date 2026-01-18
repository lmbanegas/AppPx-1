const { Pool } = require('pg');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');


// ------- Configuracion DB ------- /
const connectionString = process.env.DATABASE_URL; 

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false  
  }
});

// ------- Configuracion DB ------- /



const login = async (req, res) => {
  res.render('login')
};

const testdb = async (req, res) => {
  try {


    const query = 'SELECT 1';
    const result = await pool.query(query);

    console.log("Intento ok" + result)

    res.send("Consulta a DB ok")
    
  } catch (error) {
    console.log("error catch")
    res.status(500).send('DB error: ' + error.message);
  }
}

const loginPost = async (req, res) => {
  try {

    let errors = validationResult(req);
    const enteredUsername = req.body.username;
    const enteredPassword = req.body.password;

    const username = process.env.ADMIN_USER;
    const passwordHash = process.env.ADMIN_PASSWORD_HASH;

    if (enteredUsername === username && await bcrypt.compare(enteredPassword, passwordHash)) {
      res.cookie('username', enteredUsername, { maxAge: 24 * 60 * 60 * 1000, httpOnly: true, secure: true });
      req.session.user = enteredUsername;
      res.redirect('/');
    } else {
      errors.errors.push({ param: 'general', msg: 'Usuario y/o contraseña incorrectos' });
      console.log(errors)

      return res.render('login', { errors });
    }
  } catch (error) {
    console.error('Error during login:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


const allpacientes = async (req, res) => {
  try {
    const query = 'SELECT * FROM public.px order by nombreyapellido';
    const result = await pool.query(query);
    res.render('pacientes', { pacientes: result.rows });
  } catch (error) {
    console.error('Error de consulta:', error.message);
    res.status(500).send('Error de consulta');
  }
};


const detail = async (req, res) => {
  try {
    const id = req.params.id;
    const query = 'SELECT * FROM public.px WHERE id = $1'
    const result = await pool.query(query, [id]);


    if (result.rows.length > 0) {
      const dato = result.rows[0];
      res.render('detallePaciente', { dato });
    } else {
      res.status(404).send('Dato no encontrado');
      res.render('detallePaciente');
    }


  } catch (error) {
    console.error('Error de consulta:', error.message);
    res.status(500).send('Error de consulta');
  }
};

const hc = async (req, res) => {
  try {
    const id = req.params.id;

    //Requiero datos personales
    const query = 'SELECT * FROM public.px WHERE id = $1'
    const result = await pool.query(query, [id]);


    //Requiero historia
    const queryHc = 'SELECT * FROM public.historiapx WHERE idPaciente = $1  ORDER BY fecha';
    const resultHc = await pool.query(queryHc, [id]);

    if (result.rows.length > 0 & resultHc.rows.length > 0) {
      const dato = result.rows[0];
      const datoHC = resultHc.rows;

      console.log(datoHC)
      res.render('historiaClinica', { dato: dato, datoHC: datoHC });
    } else {
      res.status(404).send('Historia clínica no encontrada');
    }
  } catch (error) {
    console.error('Error de consulta:', error.message);
    res.status(500).send('Error de consulta');
  }
};


const nuevaEntrada = async (req, res) => {
  const resultado = "SELECT historiapx.IDPACIENTE, historiapx.fecha, px.nombreyapellido FROM historiapx INNER JOIN px ON px.id = historiapx.idpaciente WHERE historiapx.fecha = (SELECT MAX(h.fecha)    FROM historiapx h    WHERE h.idpaciente = historiapx.idpaciente);";
  const resultados = await pool.query(resultado);
  console.log(resultados)
  res.render('nuevaEntrada', { resultados: resultados.rows });

};

const nuevaEntradaPost = async (req, res) => {
  try {
    console.log(req.body)
    const { px, fecha, comentario } = req.body;

    const query = 'INSERT INTO public.historiapx (idpaciente, fecha, comentario) VALUES ($1, $2, $3) RETURNING *';
    const result = await pool.query(query, [px, fecha, comentario]);

    res.redirect(`/pacientes/`);
  } catch (error) {
    console.error('Error al agregar nueva entrada:', error.message);
    res.status(500).send('Error al agregar entrada');
  }
};


const editarEntrada = async (req, res) => {
  try {

    const id = req.params.id;

    const query = `
    SELECT historiapx.*, px.nombreyapellido, historiapx.comentario, historiapx.idpaciente
    FROM public.historiapx
    JOIN public.px ON historiapx.idpaciente = px.id
    WHERE historiapx.id = $1
  `;

    const resultados = await pool.query(query, [id]);

    res.render('editEntrada', { resultados: resultados.rows });

  } catch (error) {
    console.error('Error al agregar nueva entrada:', error.message);
    res.status(500).send('Error al agregar entrada');
  }
};


const editarEntradaPost = async (req, res) => {
  try {
    const { idHC, fecha, comentario } = req.body;

    const query = `
      UPDATE public.historiapx 
      SET fecha = $2, comentario = $3 
      WHERE id = $1
      RETURNING *`;

    const values = [
      idHC,
      fecha,
      comentario,
    ];

    const result = await pool.query(query, values);

    res.redirect(`/pacientes/`);
  } catch (error) {
    console.error('Error al agregar nueva entrada:', error.message);
    res.status(500).send('Error al agregar entrada');
  }
};


const detalleEditarPaciente = async (req, res) => {
  try {
    const id = req.params.id;

    const query = 'SELECT * FROM public.px WHERE id = $1'
    const result = await pool.query(query, [id]);
    const dato = result.rows[0];


    res.render('editarPaciente', { dato });
  } catch (error) {
    console.error('Error al mostrar formulario de edición:', error.message);
    res.status(500).send('Error al mostrar formulario de edición');
  }
};


const editarPaciente = async (req, res) => {

  try {
    const {
      nombreyapellido,
      fechaNacimiento,
      documento,
      domicilio,
      nucleoFamiliar,
      telefono,
      telefonoAlternativo,
      antecedentesFamiliares,
      antecedentesPersonales,
      motivoConsulta,
      obraSocial,
      id,
    } = req.body;


    const query = `
        UPDATE public.px SET 
        nombreyapellido = $1, 
        fechanacimiento = $2, 
        documento = $3, 
        domicilio = $4, 
        nucleofamiliar = $5, 
        telefono = $6, 
        telefonoalternativo = $7, 
        antecedentesfamiliares = $8, 
        antecedentespersonales = $9, 
        motivoconsulta = $10, 
        obrasocial = $11
        WHERE id = $12
        RETURNING *`;

    const values = [
      nombreyapellido,
      fechaNacimiento,
      documento,
      domicilio,
      nucleoFamiliar,
      telefono,
      telefonoAlternativo,
      antecedentesFamiliares,
      antecedentesPersonales,
      motivoConsulta,
      obraSocial,
      id,
    ];

    const result = await pool.query(query, values);




    res.redirect(`/pacientes/`);
  } catch (error) {
    console.error('Error al editar datos del paciente:', error.message);
    res.status(500).send('Error al editar datos del  paciente');
  }
};


const nuevoPaciente = (req, res) => {
  res.render('nuevoPaciente');
};


const nuevoPacientePost = async (req, res) => {
  try {
    const {
      nombreyapellido,
      fechaNacimiento,
      documento,
      domicilio,
      nucleoFamiliar,
      telefono,
      telefonoAlternativo,
      antecedentesFamiliares,
      antecedentesPersonales,
      motivoConsulta,
      obraSocial
    } = req.body;

    const query = `
      INSERT INTO px 
      (nombreyapellido, fechanacimiento, documento, domicilio, nucleofamiliar, telefono, telefonoalternativo, antecedentesfamiliares, antecedentespersonales, motivoconsulta, obrasocial) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
      RETURNING *`;

    const values = [
      nombreyapellido,
      fechaNacimiento,
      documento,
      domicilio,
      nucleoFamiliar,
      telefono,
      telefonoAlternativo,
      antecedentesFamiliares,
      antecedentesPersonales,
      motivoConsulta,
      obraSocial
    ];

    // Ejecutar la consulta para insertar el nuevo paciente
    const result = await pool.query(query, values);

    const idpaciente = result.rows[0].id; // Asegúrate de obtener el ID del nuevo paciente
    const fechaHC = '1990-01-01'; // 
    const comentario = ''; // Comentario vacío

    // Ahora insertamos la historia clínica
    const resultHC = await pool.query(
      'INSERT INTO public.historiapx (idpaciente, fecha, comentario) VALUES ($1, $2, $3) RETURNING *',
      [idpaciente, fechaHC, comentario] // Todos los valores en un solo arreglo
    );

    res.redirect(`/pacientes/`);
  } catch (error) {
    console.error("Error en la inserción:", error);
    res.status(500).send("Error al agregar el paciente");
  }
};


module.exports = { login, testdb, loginPost, allpacientes, detail, hc, nuevaEntrada, nuevaEntradaPost, editarEntrada, editarEntradaPost, detalleEditarPaciente, editarPaciente, nuevoPaciente, nuevoPacientePost };
