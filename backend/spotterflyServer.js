const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
var request = require("request");
const SpotifyWebApi = require("spotify-web-api-node");
var client_id = "e1d1de2574d343f7bdfe00a18421ebb2"; // Your client id
var client_secret = "9b99f7f012634b418dfccf205afa7af3"; // Your secret
var redirect_uri = "http://localhost:8888/callback"; // Your redirect uri
var data;
require("dotenv").config();
var querystring = require("querystring");
var cookieParser = require("cookie-parser");
const app = express();
const port = process.env.PORT || 8888;
const uri = app.use(cors());
//const local = "mongodb://localhost/playground";
app.use(express.json());
const uri1 = process.env.ATLAS_URI;

mongoose.connect(uri1, {
  useNewUrlParser: true,
  useCreateIndex: true
});

const connection = mongoose.connection;
connection
  .once("open", () => {
    console.log("MongoDB database connection established successfully");
  })
  .catch(err => console.error("could not connect to mongodb", err));

const userDataRouter = require("./routes/userData");
const ArtistRouter = require("./routes/Artist");

var client_id = "e1d1de2574d343f7bdfe00a18421ebb2"; // Your client id
var client_secret = "9b99f7f012634b418dfccf205afa7af3"; // Your secret
var redirect_uri = "http://localhost:8888/callback"; // Your redirect uri
const spotifyApi = new SpotifyWebApi();
/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = "";
  var possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = "spotify_auth_state";

app
  .use(express.static(__dirname + "/public"))
  .use(cors())
  .use(cookieParser());

app.get("/login", function(req, res) {
  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope =
    "user-read-private user-read-email user-read-playback-state user-top-read playlist-read-private";
  res.redirect(
    "https://accounts.spotify.com/authorize?" +
      querystring.stringify({
        response_type: "code",
        client_id: client_id,
        scope: scope,
        redirect_uri: redirect_uri,
        state: state
      })
  );
});

app.get("/callback", function(req, res) {
  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect(
      "/#" +
        querystring.stringify({
          error: "state_mismatch"
        })
    );
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: "https://accounts.spotify.com/api/token",
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: "authorization_code"
      },
      headers: {
        Authorization:
          "Basic " +
          new Buffer(client_id + ":" + client_secret).toString("base64")
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        var access_token = body.access_token,
          refresh_token = body.refresh_token;

        var options = {
          url: "https://api.spotify.com/v1/me",
          headers: { Authorization: "Bearer " + access_token },
          json: true
        };

        // use the access token to access the Spotify Web APIß
        request.get(options, function(error, response, body) {
          console.log(body);
        });

        // we can also pass the token to the browser to make requests from there
        res.redirect(
          "http://localhost:3000/app#" +
            querystring.stringify({
              access_token: access_token,
              refresh_token: refresh_token
            })
        );
      } else {
        res.redirect(
          "http://localhost:3000/app#" +
            querystring.stringify({
              error: "invalid_token"
            })
        );
      }
    });
  }
});

app.get("/refresh_token", function(req, res) {
  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: "https://accounts.spotify.com/api/token",
    headers: {
      Authorization:
        "Basic " +
        new Buffer(client_id + ":" + client_secret).toString("base64")
    },
    form: {
      grant_type: "refresh_token",
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      spotifyApi.setAccessToken(access_token);
      res.send({
        access_token: access_token
      });
    }
  });
});

app.use("/userData", userDataRouter);
app.use("/Artist", ArtistRouter);

spotifyApi.getMe().then(
  function(data) {
    console.log("Some information about the authenticated user", data.body);
  },
  function(err) {
    console.log("Something went wrong!", err);
  }
);

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});

module.exports = { app };
