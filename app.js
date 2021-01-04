var createError = require('http-errors');
var express = require('express');
var cors = require("cors");
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
// var ngrok = require('ngrok')

var indexRouter = require('./routes/index');
var contentVerificationRouter = require(path.resolve('.', 'modules/content-verification/contentVerificationRoutes'));

//The below object is to catch the requrestId and its respective res object,
// This we will use in CallBAck APi.
global.VideoModeration_RequestList = {};

console.log("content-verification-started")



var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(cors());
// app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
// app.use(helmet());
app.use(contentVerificationRouter);
// app.use(fileControllerRouter);
app.use('/', indexRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// app.listen((process.env.PORT || '3001'), () => {
//   console.log("Application listening on process.env.PORT ", process.env.PORT);
//   (async function () {
//     const url = await ngrok.connect((process.env.PORT || '3001'));
//     global.CB_URL = url;
//     console.log("Application listening on url", url)
//   })()

// })

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
