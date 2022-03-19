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

/**
 * configuration of remote database
 */
const config = {
    connectionString: 'postgresql://admin:paSIrCuRMAOqC6Ss2kOiCJrgLKDOjY@b911f7c0-39e5-4cf4-afa2-965548c68765.aws.ybdb.io:5433/postgres?ssl=true&sslmode=verify-full&sslrootcert=./root.crt',
    // Beware! The ssl object is overwritten when parsing the connectionString
    ssl: {
      rejectUnauthorized: false,
      ca: fs.readFileSync('root.crt').toString(),
    },
  }

  // Connection pool for reuse of connections during the application lifetime
  const Pool = require('pg').Pool;
  const pool = new Pool(config);

  pool
  .connect()
  .then(function(client) {
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

    /*
     * Send data as json body to the server! To access use request.body
    */
    app.post('/insert', (request, response, next) => {
      
      /*response.writeHead(200, { 'Content-Type': 'application/json' });
      response.write(JSON.stringify(request.body));
      response.end();*/

      const user = request.body;

      const q = "INSERT INTO users(username, email, age) VALUES('"+user.username+"','"+user.email+"', "+user.age+")";

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
    })

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


