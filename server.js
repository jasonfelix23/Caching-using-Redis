const express = require("express");
//using axios@0.21, because I was getting some import errors
const axios = require("axios");
const redis = require("redis");

const app = express();
const port = process.env.PORT || 3000;
//---------------CONNECTION TO DBS----------------
//-------------------REDIS-----------------------
const redisClient = redis.createClient();
redisClient.on("connect", ( ) => { console.log("SUCCESS:Connected to Redis"); });
redisClient.on("error", error => { 
    console.error(error); 
});

//---------------FETCH FROM API-----------------
async function fetchApiData(season, player_id) {
  const apiResponse = await axios.get(
    `https://www.balldontlie.io/api/v1/stats?seasons[]=${season}&player_ids[]=${player_id}`
  );
  console.log("Sending a GET request to the API");
  return apiResponse.data;
}

async function getStats(req, res) {
  console.log("\nEntering REST endpoint");
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
      console.log("KEY not found in REDIS :(");
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
      console.log("KEY found in Redis :)");
      isCached = true
      res.send({
        fromCache: isCached,
        data : response,
      })
    }
  })
}

app.get("/season", getStats);
//ex. localhost:3000/season?year=2022&id=237  -> This will return the stats of LeBron James for the year 2022

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
