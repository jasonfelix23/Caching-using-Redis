const axios = require("axios");     // https://www.npmjs.com/package/axios HTTP Client
const cors = require("cors");       // https://www.npmjs.com/package/cors Cross-origin resource sharing (CORS). Allows 
                                    //      restricted resources on a web page to be requested from another domain 
                                    //      outside the domain from which the first resource was served.
const express = require("express"); // https://www.npmjs.com/package/express Web application framework
// const { pgClient } = require("pg"); // https://www.npmjs.com/package/pg. Non-blocking PostgreSQL client.
// const pg = require("pg-promise")(); // https://www.npmjs.com/package/pg-promise PostgreSQL interface for node.js
const redis = require("redis");     // https://www.npmjs.com/package/redis In-memory data structure store, used as a 
                                    //      database, cache, and message broker. 

app = express();

//
// Establish postgres connection
//
// const db = pg({
//     host: "host",   // Can't use localhost for wsl connections to the Windows postgres server. See 
//         // https://stackoverflow.com/questions/56824788/how-to-connect-to-windows-postgres-database-from-wsl
//         // for details and how I set up this host parameter.
//     port: 5432,
//     database: "testdb",
//     user: "postgres",
//     password: "abc123"
// });

//
// Establish Redis connection
//
const DEFAULT_EXPIRATION = 3600;
const redisClient = redis.createClient();
redisClient.on("connect", ( ) => { console.log("Connected to Redis"); });
redisClient.on("error", err => { 
    let msg = "Error connecting to Redis: " + err;
    console.error(msg); 
    throw new FatalError(msg);
});

//
// REST API endpoint
//
app.get("/universities", async (req, res) => {
    console.log("In the REST endpoint");
    //
    // https://github.com/Hipo/university-domains-list
    // API: https://github.com/Hipo/university-domains-list-api  parameters: country, name
    // example http://universities.hipolabs.com/search?country=United+States
    //

    // Build a redis key and check if we've already cached this query
    let key = `universities:${req.query.country}:${req.query.name}`;
    console.log(`  Redis Key: ${key}`);

    await redisClient.get(key, async (err, reply) => {
        if (err) {
            const msg = "  Redis get error: " + err
            console.error(msg);
            res.send(msg);
            return
        }

        if (reply == null) {
            // Not in redis cache - build a query URL based on our GET parameters
            console.log("  Redis cache miss");
            let url = "http://universities.hipolabs.com/search?";
            let needSep = false;
            
            if (typeof req.query.country !== "undefined") {
                url += `country=${req.query.country}`;
                needSep = true;
            }
            
            if (typeof req.query.name !== "undefined") {
                if (needSep) url += "&";
                url += `name=${req.query.name}`;
                needSep = true;
            }
            
            console.log(`  URL: ${url}`);
            
            try {
                const response = await axios.get(url);
                // console.log(response.data);
                res.send(response.data);

                // cache in Redis
                await redisClient.set(key, JSON.stringify(response.data));
            } catch(e) {
                console.error(e);
                res.send("Error in REST endpoint: " + e);
            }
        } else {
            // Redis cache hit!  Output the data
            console.log("  Redis cache HIT!");
            res.send(JSON.parse(reply));
        }
    });

})

//
// Postgresql endpoint
//
// app.get("/orders", async (req, res) => {
//     console.log("In the Postgres endpoint");
    
//     // Build a redis key and check if we've already cahced this query
//     let key = "orders:";
//     key += req.query.OrderID + ":";
//     key += req.query.ProductID + ":";
//     key += req.query.UnitPrice + ":";
//     key += req.query.Quantity + ":";
//     key += req.query.Discount;
//     console.log("  Redis Key: " + key);

//     await redisClient.get(key, async(err, reply) => {
//         if (err) {
//             const msg = "  Redis get error: " + err
//             console.error(msg);
//             res.send(msg);
//             return
//         }

//         if (reply == null) {
//             // Not in redis cache - build an SQL query
//             console.log("  Redis cache miss");
//             let qs = "SELECT * FROM OrderDetails";
//             let addedWhere = false;
        
//             if (typeof req.query.OrderID !== "undefined") {
//                 qs += ` WHERE OrderID=${req.query.OrderID}`;
//                 addedWhere = true;
//             }
        
//             if (typeof req.query.ProductID !== "undefined") {
//                 qs += (addedWhere ? " AND " : " WHERE ");
//                 qs += `ProductID=${req.query.ProductID}`;
//                 addedWhere = true;
//             }
            
//             if (typeof req.query.UnitPrice !== "undefined") {
//                 qs += (addedWhere ? " AND " : " WHERE ");
//                 qs += `UnitPrice=${req.query.UnitPrice}`;
//                 addedWhere = true;
//             }
            
//             if (typeof req.query.Quantity !== "undefined") {
//                 qs += (addedWhere ? " AND " : " WHERE ");
//                 qs += `Quantity=${req.query.Quantity}`;
//                 addedWhere = true;
//             }
            
//             if (typeof req.query.Discount !== "undefined") {
//                 qs += (addedWhere ? " AND " : " WHERE ");
//                 qs += `Discount=${req.query.Discount}`;
//                 addedWhere = true;
//             }
            
//             qs += ";";
//             console.log("  Query: " + qs);
        
//             try {
//                 const response = await db.any(qs, [true]);
//                 res.send(response);

//                 // cache in Redis
//                 await redisClient.set(key, JSON.stringify(response));
//             }
//             catch(e) {
//                 console.error("Error in Postgres endpoint: ", e);
//                 res.send("Error in Postgres endpoint: " + e);
//             }
//         } else {
//             // Redis cache hit! Output the data
//             console.log("  Redis cache HIT!");
//             res.send(JSON.parse(reply));
//         }

//     });

// })
//
// Launch the server
//



  // try {
  //   const cacheResults = await redisClient.get(key);
  //   console.log(cacheResults)
  //   if (cacheResults) {
  //     console.log("In redis-cache")
  //     isCached = true;
  //     results = JSON.parse(cacheResults);
  //   }else{
  //   results = await fetchApiData(seasons, player_id);
  //   if (results.length === 0) {
  //     throw "API returned an empty array";
  //   }
  //   await redisClient.set(s_i, JSON.stringify(results));
  // }
  //   res.send({
  //     fromCache: isCached,
  //     data: results,
  //   });
  // } catch (error) {
  //   console.error(error);
  //   res.status(404).send("Data unavailable");
  // }
app.listen(3000);