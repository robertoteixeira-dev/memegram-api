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

const tokens = {};
pool
  .connect()
  .then(function (client) {
    console.log('connected')

    const express = require('express')
    const cors = require('cors');
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
      tempFileDir: './tmp/'
    }));

    app.use(cookieParser());

    app.use(express.static(__dirname + '/public'));
    app.use(cors());

    /*
     * Send data as json body to the server! To access use request.body
    */
    app.post('/users', (request, response, next) => {

      const user = JSON.parse(request.body.user);
      const profile = request.files.profile;

      user.id = uuidv4.v4();
      user.tmp = Date.now();
      var password = user.password;

      const shasum = crypto.createHash('sha256');

      shasum.update(JSON.stringify(password));
      user.password = shasum.digest('hex');

      const ext = profile.name.split('.').pop();

      profile.mv(path.join(__dirname, 'public/profiles', `${user.id}.${ext}`), (err) => {

        if (err) {
          next(err.stack);
          return;
        };

        const q = `INSERT INTO users(id, username, email, signUpTime, password, ext) VALUES('${user.id}', '${user.username}', '${user.email}', ${user.tmp}, '${user.password}', '${ext}')`;

        // callback
        client.query(q, (err, res) => {
          if (err) {
            next(err.stack);
          } else {
            response.setHeader('Access-Control-Allow-Origin', '*').json({message: 'user inserted!'});
          }

          // client.release()
        });

      }) 

    });

    app.post('/followers', (request, response, next) => {

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

    app.post('/upload', (request, response, next) => {

      const token = request.get('access_token');
      
      if(token == undefined || token == null){
        response.status(401).json({});
        return;
      } 

      const userId = tokens[token];

      console.log(`[upload]token: ${token} u: ${userId}`);
      
      if(userId == undefined || userId == null){
        response.status(401).json({});
        return;
      } 

      const body = request.body;

      console.log(body);

      const description = body.post.description;
      const img = request.files.image;

      const id = uuidv4.v4();
      const tmp = Date.now();

      const ext = img.name.split('.').pop();

      img.mv(path.join(__dirname, 'public/images', `${id}.${ext}`), (err) => {
        if (err) throw err;

        const q = `INSERT INTO posts(id, body, timestamp, ext, user_id) VALUES('${id}', '${description}', ${tmp}, '${ext}', '${userId}')`;

        // callback
        client.query(q, function(err, res){
          if (err) {
            next(err.stack);
          } else {
            response.setHeader('Access-Control-Allow-Origin', '*').json({message: 'post inserted!'})
          }

        });
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

    app.get('/posts/:offset/:n', (request, response, next) => {

      const token = request.get('access_token');
      
      if(token == undefined || token == null){
        response.status(401).json({});
        return;
      } 

      const id = tokens[token];

      console.log(`[posts]token: ${token} u: ${id}`);
      
      if(id == undefined || id == null){
        response.status(401).json({});
        return;
      } 

      const params = request.params;
      const offset = params.offset;
      const n = params.n;

      const q = `select p.id, p.body, p."timestamp", p.ext, p.user_id, u.ext as profile_ext, u.username from posts as p join users as u on p.user_id = u.id where u.id = '${id}' order by p.id LIMIT ${n} OFFSET ${offset};`;

      client.query(q, (err, res) => {
        if (err) {
          next(err);
        } else {
          response.setHeader('Access-Control-Allow-Origin', '*').json(res.rows);
        }
      });

      //response.setHeader('Access-Control-Allow-Origin', '*').json({message: "hi"});
    })

    app.post('/login', (request, response, next) => {

      const body = request.body;
      
      const login = body.login;
      var password = body.password;

      const shasum = crypto.createHash('sha256');

      shasum.update(JSON.stringify(password));
      password = shasum.digest('hex');
  
      const q = `SELECT * FROM users where (username='${login}' or email='${login}') and password = '${password}';`;

      client.query(q, (err, res) => {
        if (err) {
          next(err);
        } else {

          // Se username e senha estao corretos, retorna uma linha (row)
          if(res.rowCount == 1){

            const token = uuidv4.v4();

            const id = res.rows[0].id;
            tokens[token] = id;

            response
              .setHeader('Access-Control-Allow-Origin', '*')
              /*.cookie('user_cookie', {
                id: res.rows[0].id
              })*/.json({access_token: token});

              // Senha ou username errados
          } else {
            response.setHeader('Access-Control-Allow-Origin', '*').json(null);
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

    app.post('/logout', (request, response, next) => {
      //response.clearCookie('user').end('successfull logout....');

      const token = request.headers.acess_token;

      if(tokens[token] != undefined){
        tokens[token] = undefined;
      }

      response.json({});
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


