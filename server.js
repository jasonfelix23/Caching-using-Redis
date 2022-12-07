const express = require("express");
//using axios@0.21, because I was getting some import errors
const axios = require("axios");
const redis = require("redis");
const {Client} = require("pg");

const app = express();
const port = process.env.PORT || 3000;
//---------------CONNECTION TO DBS----------------
//-------------------REDIS-----------------------
const redisClient = redis.createClient();
redisClient.on("connect", ( ) => { console.log("SUCCESS: CONNECTED TO REDIS"); });
redisClient.on("error", error => { 
    console.error(error); 
});
// ---------------POSTGRES-----------------------
let client;
const connectDb = async () => {
  try {
  client = new Client({
      host:"winhost",
      user: "postgres",
      port: 5432,
      password: "abc123",
      database: "postgres"
  })
  
  await client.connect()
  } catch (error) {
  console.log(error)
  }
  }


//---------------FETCH FROM API-----------------
async function fetchApiData(season, player_id) {
  const apiResponse = await axios.get(
    `https://www.balldontlie.io/api/v1/stats?seasons[]=${season}&player_ids[]=${player_id}`
  );
  console.log("SENDING REQUEST TO API");
  return apiResponse.data;
}


//-------------FUNCTION TO HANDLE REST ENDPOINT------------
async function getStats(req, res) {
  console.log("\nINSIDE REST ENDPOINT");
  let seasons, player_id;
  //Dealing with no parameters
  if(typeof req.query.year !== "undefined"){
    seasons = req.query.year;
  }else{
    seasons =2022     //default season
  }
  if(typeof req.query.id !== "undefined"){
    player_id = req.query.id;
  }else{
    player_id = 237       //default player_id
  }
  
  let key = `season:${seasons}+player:${player_id}`
  console.log(`REDIS KEY: ${key}`)
  let results;
  let isCached = false;

  //looking if the key exists in cache
  await redisClient.get(key, async (err, response)=>{
    if(err){
      console.error(err);
      res.send(err);
      return
    }
    if(response == null){
      //Not in redis cache, hence calling fetchAPI
      console.log("KEY NOT FOUND IN REDIS :(");
      try{
        results = await fetchApiData(seasons, player_id);
        res.send({
          fromCache: isCached,
          data : results,
        });
        //storing the key in cache with the recieved results
        await redisClient.set(key, JSON.stringify(results));
      } catch(e){
        console.error(e);
        res.status(404).send("Data unavailable");
      }
    } else{
      console.log("KEY FOUND IN REDIS :)");
      isCached = true
      res.send({
        fromCache: isCached,
        data : response,
      })
    }
  })
}

//------------FUNCTION TO HANDLE POSTGRES ENDPOINT--------------
async function getFromPostgres(req, res){
  console.log("\nINSIDE POSTGRES ENDPOINT");
  connectDb();
  let pid, pname, age, nationality, club_name;
  let key = "football:";
  let query = 'SELECT * FROM public."Football"';
  let modifyquery = false;                     

  //building query as we biuld key to remove redundancy
  if(typeof req.query.id !== "undefined"){
    pid = req.query.id
    query += ` WHERE id=${pid}`;
    modifyquery = true;
    key += `id:${pid}+`
  }
  if(typeof req.query.name !== "undefined"){
    pname = req.query.name
    //if the query is alraedy modified then we don't add 'WHERE', instead we add 'AND'
    query += (modifyquery ? " AND " : " WHERE ");
    query += `name='${pname}'`;
    modifyquery = true;
    key += `name:${pname}+`
  }
  if(typeof req.query.age !== "undefined"){
    age = req.query.age
    query += (modifyquery ? " AND " : " WHERE ");
    query += `age=${age}`;
    modifyquery = true;
    key += `age:${age}+`
  }
  if(typeof req.query.nationality !== "undefined"){
    nationality = req.query.nationality
    query += (modifyquery ? " AND " : " WHERE ");
    query += `nationality='${nationality}'`;
    modifyquery = true;
    key += `nationality:${nationality}+`
  }
  if(typeof req.query.club_name !== "undefined"){
    club_name = req.query.club_name
    query += (modifyquery ? " AND " : " WHERE ");
    query += `club_name='${club_name}'`;
    modifyquery = true;
    key += `club_name:${club_name}`
  }
  query += ";"
  console.log(`QUERY -> ${query}`)
  console.log(`REDIS KEY : ${key}`)
  let results;
  let isCached = false;

  //looking if the key exists in cache
  await redisClient.get(key, async (err, response)=>{
    if(err){
      console.error(err);
      res.send(err);
      return
    }
    if(response == null){
      //Not in redis cache, hence calling fetchAPI
      console.log("KEY NOT FOUND IN REDIS :(");
      try{
        results = await client.query(query)
          // const res = await client.query('SELECT * FROM public."Football" where id=1')
        // console.log(results)
        await client.end()
        res.send({
          fromCache: isCached,
          data : results,
        });
        //storing the key in cache with the recieved results
        await redisClient.set(key, JSON.stringify(results));
      } catch(e){
        console.error(e);
        res.status(404).send("Data unavailable");
      }
    } else{
      console.log("KEY FOUND IN REDIS :)");
      isCached = true
      res.send({
        fromCache: isCached,
        data : response,
      })
    }
  })

}


app.get("/nba", getStats);
//ex. localhost:3000/nba          ---> This will assign default values for fetching api. The default values are year=2022 and id=237
//ex. localhost:3000/nba?year=2015  ---> This will assign default value to id but return the stats of that player from 2015
//ex. localhost:3000/nba?id=200      ---> This will assign default value to year and return the stats of that player for 2022
//ex. localhost:3000/nba?year=2022&id=237  ---> This will return the stats of player with id=237(LeBron James) for the year 2022



app.get("/football", getFromPostgres);
//ex. localhost:3000/football?id=1   --->This will return the data about the player with id=1(Cristiano Ronaldo)
//ex. localhost:3000/football?nationality="France"    ---> This will return all the players from France
//ex. localhost:3000/football?nationality="France"&age=24   ---> This will return all the players from France who are 24 years old
//ex. localhost:3000/football   ---> This will return the entire db


app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
