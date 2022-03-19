/*import {Connection} from 'postgresql-client';

const connection = new Connection('postgresql://admin:paSIrCuRMAOqC6Ss2kOiCJrgLKDOjY@b911f7c0-39e5-4cf4-afa2-965548c68765.aws.ybdb.io:5433/postgres?ssl=true&sslmode=verify-full&sslrootcert=./root.crt');
await connection.connect();
const result = await connection.query(
    'select * from cities where name like $1',
    {params: ['%york%']});
const rows = result.rows;

await connection.close(); // Disconnect
*/

const fs = require('fs');
const uuidv4 = require('uuid');
const fileUpload = require('express-fileupload');
const path = require('path');

const crypto = require('crypto');
const cookieParser = require("cookie-parser");
const { send } = require('process');

/**
 * configuration of remote database
 */
const config = {
  connectionString: 'postgresql://postgres:1234@localhost:5432/postgres',
  // Beware! The ssl object is overwritten when parsing the connectionString
  /*ssl: {
    rejectUnauthorized: false,
    ca: fs.readFileSync('root.crt').toString(),
  },*/
}

// Connection pool for reuse of connections during the application lifetime
const Pool = require('pg').Pool;
const pool = new Pool(config);


pool
  .connect()
  .then(function (client) {
    console.log('connected')

    const express = require('express')
    const bodyParser = require('body-parser')
    const app = express()
    const port = 3001

    app.use(bodyParser.json())
    app.use(
      bodyParser.urlencoded({
        extended: true,
      })
    )

    app.use(fileUpload({
      useTempFiles: true,
      tempFileDir: './public/tmp/'
    }));

    app.use(cookieParser());

    app.use(express.static(__dirname + '/public'));

    /*
     * Send data as json body to the server! To access use request.body
    */
    app.post('/users', (request, response, next) => {

      /*response.writeHead(200, { 'Content-Type': 'application/json' });
      response.write(JSON.stringify(request.body));
      response.end();*/

      const user = request.body;
      const id = uuidv4.v4();
      const tmp = Date.now();

      const q = `INSERT INTO users(id, username, email, signUpTime) VALUES('${id}', '${user.username}', '${user.email}', ${tmp})`;

      // callback
      client.query(q, (err, res) => {
        if (err) {
          next(err.stack)
        } else {
          response.setHeader('Access-Control-Allow-Origin', '*').end("user inserido!")
        }

        // client.release()
      });

    });

    app.post('/followers', (request, response, next) => {

      /*response.writeHead(200, { 'Content-Type': 'application/json' });
      response.write(JSON.stringify(request.body));
      response.end();*/

      const body = request.body;

      const follower_id = body.follower;
      const followee_id = body.followee;
      const tmp = Date.now();

      const q = `INSERT INTO followers(follower_id, followee_id, timestamp) VALUES('${follower_id}', '${followee_id}', ${tmp})`;

      // callback
      client.query(q, (err, res) => {
        if (err) {
          next(err.stack)
        } else {
          response.setHeader('Access-Control-Allow-Origin', '*').end("follower inserido!")
        }

        // client.release()
      });

    });

    app.post('/posts', (request, response, next) => {

      /*response.writeHead(200, { 'Content-Type': 'application/json' });
      response.write(JSON.stringify(request.body));
      response.end();*/

      const body = request.body;

      const description = body.description;
      const user_id = body.user_id;
      const img = request.files.img;

      const id = uuidv4.v4();
      const tmp = Date.now();

      const ext = img.name.split('.').pop();

      img.mv(path.join(__dirname, 'public/tmp', `${id}.${ext}`), (err) => {
        if (err) throw err;

        const q = `INSERT INTO posts(id, body, timestamp, ext, user_id) VALUES('${id}', '${description}', ${tmp}, '${ext}', '${user_id}')`;

        // callback
        client.query(q, function(err, res){
          if (err) {
            //next(err.stack)

            response.status(500);
            response.end('something bad has happened!');

          } else {
            response.setHeader('Access-Control-Allow-Origin', '*').end("post inserido!")
          }

          // client.release()
        });

        //response.setHeader('Access-Control-Allow-Origin', '*').end("yeah")
      });

      
    });

    app.get('/users', (request, response, next) => {

      const q = "SELECT * FROM users;";

      // callback
      client.query(q, (err, res) => {
        if (err) {
          next(err.stack)
        } else {
          response.setHeader('Access-Control-Allow-Origin', '*').json(res.rows)
        }

       // client.release()
      })
    });

    app.get('/posts/:id/:offset/:n', (request, response, next) => {

      const params = request.params;
      const id = params.id;
      const offset = params.offset;
      const n = params.n;

      const q = `select p.id, p.body, p."timestamp", p.ext, u.username from posts as p join users as u on p.user_id = u.id order by p.id LIMIT ${n} OFFSET ${offset};`;

      client.query(q, (err, res) => {
        if (err) {
          next(err);
        } else {
          response.setHeader('Access-Control-Allow-Origin', '*').json(res.rows);
        }
      });

    })

    app.get('/login', (request, response, next) => {

      const body = request.body;

      const username = body.username;
      var password = body.password;

      const shasum = crypto.createHash('sha256');

      shasum.update(JSON.stringify(password));
      password = shasum.digest('hex');

      const q = `SELECT * FROM users where username='${username}' and password = '${password}';`;

      client.query(q, (err, res) => {
        if (err) {
          next(err);
        } else {

          // Se username e senha estao corretos, retorna uma linha (row)
          if(res.rowCount == 1){

            response
              .setHeader('Access-Control-Allow-Origin', '*')
              .cookie('user', {
                id: 'lucas'
              }).end('logado com sucesso!');

              // Senha ou username errados
          } else {
            response.setHeader('Access-Control-Allow-Origin', '*').end('username or password is wrong!');
          }

        }
      });

    });

    app.get('/protected', (request, response, next) => {

      const user = request.cookies.user;

      if(user == null){
        response.end('you must be logged to access this functionality');
      } else {
        response.end('access granted!');
      }

    });

    app.get('/logout', (request, response, next) => {

      response.clearCookie('user').end('successfull logout....');
  
    });

    app.listen(port, () => {
      console.log(`App running on port ${port}.`)
    })

    /*const q = "SELECT * FROM users where username='vitor';";

    // callback
    client.query(q, (err, res) => {
      if (err) {
        console.log(err.stack)
      } else {
        console.log(res.rows);
      }

      client.release()
    })*/


  })
  .catch(err => console.error('error connecting', err.stack))
  .then(() => pool.end())


