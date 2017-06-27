var Evernote = require('evernote');

var config = require('../config.json');
var callbackUrl = "http://localhost:3000/oauth_callback";

const MongoClient = require('mongodb').MongoClient
var EvernoteData     = require('../models/evernote');

var mongoose   = require('mongoose');
mongoose.connect('mongodb://localhost/evernote'); // connect to our database

// get nodebook list
getNotebooks = function(req, res, token){
  var client = new Evernote.Client({
    token: token,
    sandbox: config.SANDBOX,
    china: config.CHINA
  });
  client.getNoteStore().listNotebooks().then(function(notebooks) {
    req.session.notebooks = notebooks;
    res.render('index', {session: req.session});
    
    client.getNoteStore().listTags().then(function(tags){
        console.log(tags);
        gistGuid = null;
        tags.forEach(function(value, index){
          console.log(value, index);
          if(value.name === 'gist'){
            gistGuid = value.guid;
          }
        });  
        if(gistGuid){
          // prepare search parameters
          var filter = new Evernote.NoteStore.NoteFilter({
            tagGuids: [gistGuid],
            ascending: true
          });
          var spec = new Evernote.NoteStore.NotesMetadataResultSpec({
            includeTitle: true,
            includeContentLength: true,
            includeCreated: true,
            includeUpdated: true,
            includeDeleted: true,
            includeUpdateSequenceNum: true,
            includeNotebookGuid: true,
            includeTagGuids: true,
            includeAttributes: true,
            includeLargestResourceMime: true,
            includeLargestResourceSize: true,
          });
          client.getNoteStore().findNotesMetadata(filter, 0, 500, spec).then(function(nodes){
            console.log(nodes);
          }, function(error){
            console.log(error);
            req.session.error = JSON.stringify(error);
            res.render('index', {session: req.session});              
          });
        }
      }, function(error){
        req.session.error = JSON.stringify(error);
        res.render('index', {session: req.session});
      });
      
  }, function(error) {
    req.session.error = JSON.stringify(error);
    res.render('index', {session: req.session});
  });
}

// home page
exports.index = function(req, res) {
  // get user id
  var userId = req.query.uid;
  console.log(userId)
  if(userId){
    EvernoteData.findOne({userId: userId}, function(err, evernoteData) {
      if (err){
          console.log(err);
          res.render('index', {session: req.session});
      }
      // console.log(evernoteData);
      if(evernoteData && evernoteData.oauthAccessToken){
        // get the access token from db
        const oauthAccessToken = evernoteData.oauthAccessToken;
        console.log(oauthAccessToken);
        getNotebooks(req, res, oauthAccessToken)
      }else
        res.render('index', {session: req.session});        
    });
  }else
    res.render('index', {session: req.session});
};

getAuth = function(req, res, callbackUrl, userId)
{ 
  // get new token
  var client = new Evernote.Client({
    consumerKey: config.API_CONSUMER_KEY,
    consumerSecret: config.API_CONSUMER_SECRET,
    sandbox: config.SANDBOX,
    china: config.CHINA
  });
  
  // set call back url
  var callbackUrl = callbackUrl + '?uid=' + userId;

  client.getRequestToken(callbackUrl, function(error, oauthToken, oauthTokenSecret, results) {
    if (error) {
      req.session.error = JSON.stringify(error);
      res.redirect('/');
    } else {
      // store the tokens in the session
      req.session.oauthToken = oauthToken;
      req.session.oauthTokenSecret = oauthTokenSecret;

      // store tokens to db
      let evernoteData = new EvernoteData();
      evernoteData.userId = userId
      evernoteData.oauthToken = oauthToken
      evernoteData.oauthTokenSecret = oauthTokenSecret
      console.log(evernoteData)
      evernoteData.save(
        function(err) {
          if (err)
            res.send(err);
          
          console.log('function complete 1.1')

          // redirect the user to authorize the token
          res.redirect(client.getAuthorizeUrl(oauthToken));
      })
      console.log('function complete 1')
      // redirect the user to authorize the token
      // res.redirect(client.getAuthorizeUrl(oauthToken));
    }
  });
}

// OAuth
exports.oauth = function(req, res) {
  // get user id
  var userId = req.query.uid;
  console.log(userId)
  if(userId){
    EvernoteData.findOne({userId: userId}, function(err, evernoteData) {
        if (err)
            res.send(err);
        // console.log('in oauth ', evernoteData);
        if(evernoteData && evernoteData.oauthAccessToken){ 
          // get the access token from db
          const oauthAccessToken = evernoteData.oauthAccessToken
          // store the tokens in the session
          req.session.oauthToken = evernoteData.oauthToken;
          req.session.oauthTokenSecret = evernoteData.oauthTokenSecret;
          res.redirect('/?uid=' + userId);
        }else{ 
          getAuth(req, res, callbackUrl, userId);
        }
    });
  }else{
    getAuth(req, res, callbackUrl, userId);
  }
};

// OAuth callback
exports.oauth_callback = function(req, res) {
  var client = new Evernote.Client({
    consumerKey: config.API_CONSUMER_KEY,
    consumerSecret: config.API_CONSUMER_SECRET,
    sandbox: config.SANDBOX,
    china: config.CHINA
  });
  
  // get user id
  var userId = req.query.uid;
  console.log(userId)

  client.getAccessToken(
    req.session.oauthToken, 
    req.session.oauthTokenSecret, 
    req.query.oauth_verifier,
    function(error, oauthAccessToken, oauthAccessTokenSecret, results) {
      if (error) {
        console.log('error');
        console.log(error);
        res.redirect('/');
      } else {
        // store the access token in the session
        req.session.oauthAccessToken = oauthAccessToken;
        req.session.oauthAccessTokenSecret = oauthAccessTokenSecret;
        req.session.edamShard = results.edam_shard;
        req.session.edamUserId = results.edam_userId;
        req.session.edamExpires = results.edam_expires;
        req.session.edamNoteStoreUrl = results.edam_noteStoreUrl;
        req.session.edamWebApiUrlPrefix = results.edam_webApiUrlPrefix;

        EvernoteData.findOne({userId: userId}, function(err, evernoteData) {

            if (err)
                res.send(err);

            // save the access token to db
            evernoteData.userId = userId
            evernoteData.oauthAccessToken = oauthAccessToken
            evernoteData.oauthAccessTokenSecret = oauthAccessTokenSecret
            evernoteData.edamShard = results.edam_shard
            evernoteData.edamUserId= results.edam_userId
            evernoteData.edamExpires = results.edam_expires
            evernoteData.edamNoteStoreUrl = results.edam_noteStoreUrl
            evernoteData.edamWebApiUrlPrefix = results.edam_webApiUrlPrefix

            console.log(evernoteData)
            evernoteData.save(
                function(err) {
                  if (err)
                    res.send(err);
                  
                  console.log('function complete 2.1')
                  // redirect the user to authorize the token
                  res.redirect('/');
            })
        });

        console.log('function complete 2')
        
        // res.redirect('/');
      }
  });
};

// Clear session
exports.clear = function(req, res) {
  req.session.destroy();
  res.redirect('/');
};
