var api = require("./../../modules/content-verification/contentVerificationController");
var express = require('express');
var router = express.Router();

var multer = require('multer');
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});
var upload = multer({ storage: storage });

router.post('/verifyContent', upload.any(), api.CollectContent, api.VerifyTextContent, api.VerifyImageContent, api.CollectResponse);
// router.post('/postVideoProcessingResult', api.catchVidepProcessingResult);
router.post('/verifyContent', upload.any(), api.CollectContent, api.VerifyVideoContentDummyAsync, api.CollectResponse);



module.exports = router;