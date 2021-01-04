var request = require('request-promise');
var config = require('../../config');
var each = require('sync-each');
const fs = require('fs');
var sightengine = require('sightengine')(config.api_user, config.api_secret);
var responseGenerator = require("../../utils/responseGenerator");

exports.CollectContent = function (req, res, next) {
    // console.log("exports.CollectContent -> req", req);
    let imageFiles = [];
    let videoFiles = [];
    res.locals.contentToVerify = {};
    res.locals.contentToVerify.files = {
        imageFiles: [],
        videoFiles: []
    };
    res.locals.verificationResult = {
        isAbusive: false,
        abusiveType: null,
        abusiveText: '',
        verificationErrorMessage: ''
    };
    res.locals.contentToVerify.text = req.body ? Object.values(req.body) : null;
    res.locals.contentToVerify.text_keys = req.body ? Object.keys(req.body) : null;
    let requestedFiles = (req.files.length && req.files != null) ? req.files : [];
    // Below Code To Sepearate Out Image and Video Files from req.files 
    // Separation performed on the basis of mime type of the files.
    if (requestedFiles.length > 0) {
        requestedFiles.map(_file => {
            if (_file.mimetype.includes('image/')) {
                imageFiles.push(_file);
            }
            if (_file.mimetype.includes('video/')) {
                videoFiles.push(_file);
            }

        });
        // Images To Verify
        res.locals.contentToVerify.files.imageFiles = imageFiles;
        // Videos To Verify
        res.locals.contentToVerify.files.videoFiles = videoFiles;

    }
    next();
};

exports.VerifyVideoContentDummyAsync = function (req, res, next) {
    //TO DO :Here add if to check if we got any error from text or image verifcation already

    var CB_URL = global.CB_URL + '/postVideoProcessingResult';
    // var Video = 'https://sightengine.com/assets/stream/examples/funfair.mp4';
    var Video = "https://ak3.picdn.net/shutterstock/videos/1412083/preview/stock-footage-iraq-circa-u-s-soldiers-fire-a-machine-gun-from-an-abrams-tank-circa-in-iraq.webm"
    // var Video = "https://ak4.picdn.net/shutterstock/videos/24787574/preview/stock-footage-bikini-beach-woman-happy-smiling-playful-cheerful-having-fun-dancing-around-bikini-girl-wearing.webm"
    var filename = 'public/videos/bikni.webm';
    // var Video = "https://storage.googleapis.com/react-firebase-auth-demo-2d09b.appspot.com/demo-weapon-video.webm"
    // let Video = fs.ReadStream(filename);
    try {
        // Checking for weapon,alchol,nudity of the video.
        sightengine.check(['nudity', 'wad', 'offensive']).video(Video, CB_URL)
            .then(function (result) {
                console.log("exports.VerifyVideoContentDummy -> result", result);
                if (result.status == 'failure') {
                    res.send(500, responseGenerator.getResponse(500, null, result.error.message));
                } else {
                    global.VideoModeration_RequestList[result.request.id] = {}
                    global.VideoModeration_RequestList[result.request.id].resObject = res;
                    global.VideoModeration_RequestList[result.request.id].frames = [];
                    console.log("exports.VerifyVideoContentDummyAsync ->  global.VideoModeration_RequestList", global.VideoModeration_RequestList)
                }

                // next();
                // The result of the API
            }).catch(function (err) {
                throw new Error(err)
                // console.log("exports.VerifyVideoContentDummy -> err", err)
                // Error
            });

    } catch (error) {
        console.log("exports.VerifyVideoContentDummy -> error", error)

    }
}

//This Function is for Text Content Verification
exports.VerifyTextContent = async function (req, res, next) {
    let arrayTextToVerify = res.locals.contentToVerify.text;
    if (arrayTextToVerify.length == 0) {
        next();
    } else {
        let isErrorInText = false;
        let errorText = null;
        let verificationMessage = null
        let textVerifiedResultSet = arrayTextToVerify.map((TextToVerify, index) => {
            return new Promise((resolve, reject) => {
                if (isErrorInText == false) {
                    // Calling Congnitive Service of MS handle by callback
                    _VerfiyTextFromCognitiveContentModerator(TextToVerify, index, res, (err, responseCB) => {
                        if (err) {
                            reject(err);
                        } else {
                            // Error Flag and Error Message Initalisation
                            isErrorInText = responseCB.isAbusive;
                            errorText = responseCB.abusiveText ? responseCB.abusiveText : null;
                            verificationMessage = responseCB.verificationMessage ? responseCB.verificationMessage : null
                            // If found any text abusive we Reject the Promise and Execution goes to catch block
                            if (isErrorInText) {
                                reject({ isErrorInText, errorText, verificationMessage })
                            } else {
                                resolve({ isErrorInText, errorText, verificationMessage })
                            }
                        }
                    });
                } else {
                    reject(errorText)
                }
            });
        });
        try {
            await Promise.all(textVerifiedResultSet)
            if (isErrorInText == true) {
                res.locals.verificationResult = {
                    isAbusive: isErrorInText,
                    abusiveType: 'text',
                    abusiveText: errorText,
                    verificationMessage: verificationMessage
                };
                next();
            } else {
                next();
            }
        } catch (error) {
            if (isErrorInText) {
                res.locals.verificationResult = {
                    isAbusive: isErrorInText,
                    abusiveType: 'text',
                    abusiveText: errorText,
                    verificationMessage: verificationMessage
                };
                next();
            } else {
                res.send(500, responseGenerator.getResponse(500, null, 'Failed to process the request.'))
            }

        }
    }
}

exports.VerifyTextContent_Each = function (req, res, next) {
    let arrayTextToVerify = res.locals.contentToVerify.text;
    if (arrayTextToVerify.length == 0) {
        next();
    } else {
        let isErrorInText = false;
        let errorText = null;
        try {
            let i = 0;
            each(arrayTextToVerify, function (TextToVerify, nextText) {
                if (isErrorInText == false) {
                    _VerfiyTextFromCognitiveContentModerator(TextToVerify, i++, res, (err, responseCB) => {
                        if (err) {
                            throw (new Error(err))
                        } else {
                            isErrorInText = responseCB.isAbusive;
                            errorText = responseCB.abusiveText ? responseCB.abusiveText : null;
                            nextText();
                        }
                    });
                } else {
                    nextText({ isErrorInText, errorText });
                }
            }, function (error, result) {
                if (isErrorInText == true) {
                    res.send({
                        isAbusive: isErrorInText,
                        abusiveText: errorText,
                        verificationMessage: `Text content abusive words please review, Original Text is '${errorText}'`
                    });
                } else {
                    next();
                }
            });


        } catch (error) {
            if (isErrorInText) {
                res.send({
                    isAbusive: isErrorInText,
                    abusiveText: errorText,
                    verificationMessage: `Text content abusive words please review, Original Text is '${errorText}'`
                });
            } else {
                res.send((500, "Failed to process", "Failed to process"));
            }

        }
    }
}

// THis Function is for Image Content Verification 
exports.VerifyImageContent = async function (req, res, next) {
    if (res.locals.verificationResult.isAbusive == false) {
        let arrayImageFilesToVerify = res.locals.contentToVerify.files.imageFiles;
        if (arrayImageFilesToVerify.length == 0) {
            next();
        } else {
            let isErrorInImageFile = false;
            let errorText = null;
            let verificationMessage = null;
            let imageVerifiedResultSet = arrayImageFilesToVerify.map((ImageToVerify, index) => {
                return new Promise((resolve, reject) => {
                    if (isErrorInImageFile == false) {
                        _VerfiyImageFromCognitiveContentModerator(ImageToVerify, index, (err, responseCB) => {
                            if (err) {
                                reject(err);
                            } else {
                                isErrorInImageFile = responseCB.isAbusive;
                                errorText = responseCB.abusiveText ? responseCB.abusiveText : null;
                                verificationMessage = responseCB.verificationMessage ? responseCB.verificationMessage : null;
                                if (isErrorInImageFile) {
                                    reject({ isErrorInImageFile, errorText, verificationMessage })
                                } else {
                                    resolve({ isErrorInImageFile, errorText, verificationMessage })
                                }
                            }
                        });
                    } else {
                        reject(errorText)
                    }
                });
            });
            try {
                await Promise.all(imageVerifiedResultSet)
                if (isErrorInImageFile == true) {
                    res.locals.verificationResult = {
                        isAbusive: isErrorInImageFile,
                        abusiveType: 'image',
                        abusiveText: errorText,
                        verificationMessage: verificationMessage
                    };
                    next();
                } else {
                    next();
                }
            } catch (error) {
                if (isErrorInImageFile) {
                    res.locals.verificationResult = {
                        isAbusive: isErrorInImageFile,
                        abusiveType: 'image',
                        abusiveText: errorText,
                        verificationMessage: verificationMessage
                    };
                    next();
                } else {
                    res.send(500, responseGenerator.getResponse(500, null, 'Failed to process the request.'))
                }
            }
        }
    } else {
        next();
    }
}

exports.CollectResponse = function (req, res) {
    //console.log("exports.CollectResponse -> CollectResponse", res.locals.verificationResult);
    res.send(responseGenerator.getResponse(200, res.locals.verificationResult, null))

}

exports.catchVidepProcessingResult = function (req, res, next) {
    res = global.VideoModeration_RequestList[req.body.request].resObject;
    let verifiedData = req.body.data;
    // console.log("exports.catchVidepProcessingResult -> verifiedData", verifiedData)
    if (verifiedData.status == 'finished') {
        global.VideoModeration_RequestList[req.body.request].frames = global.VideoModeration_RequestList[req.body.request].frames.concat(verifiedData.frames);
        _ConclusionOfFrameResult(global.VideoModeration_RequestList[req.body.request].frames, (err, resultMessage) => {
            if (resultMessage) {
                let verificationResult = {
                    isAbusive: true,
                    abusiveType: 'video',
                    abusiveText: null,
                    verificationMessage: resultMessage
                };
                res.send(responseGenerator.getResponse(200, verificationResult, null))

            } else {
                res.send(responseGenerator.getResponse(200, verificationResult, null))

            }
        })

    }

}


function _VerfiyTextFromCognitiveContentModerator(_text, index, res, callback) {
    let arrayOfTextKeys = res.locals.contentToVerify.text_keys;

    //2. API Setup
    //2.1 Header
    let apiHeaders = {
        'Content-Type': 'text/plain',
        'Ocp-Apim-Subscription-Key': config.Ocp_Apim_Subscription_Key,
    }
    //2.2 Query Params :
    let params = new URLSearchParams([
        ['autocorrect', false],
        ['PII', false],
        ['listId', 0],
        ['classify', true],
        ['language', 'eng']
    ]);
    var options = {
        'method': 'POST',
        'url': `${config.azureServiceEndpoint}ProcessText/Screen?${params.toString()}`,
        'headers': apiHeaders,
        body: _text

    };

    try {
        request(options, function (error, response) {
            if (error) throw new Error(error);

            let resBody = JSON.parse(response.body);
            if (resBody.Classification.ReviewRecommended) {
                let _verificationMessage = `'${arrayOfTextKeys[index]}' contains abusive words please review, Original Text is '${resBody.OriginalText}'.`
                callback(null, { isAbusive: true, abusiveText: resBody.OriginalText, verificationMessage: _verificationMessage, index: index })
            } else {
                callback(null, { isAbusive: false, abusiveText: null, verificationMessage: null, index: index })
            }

        });

    } catch (error) {
        callback('Something Went Wrong', null)
    }

}

function _VerfiyImageFromCognitiveContentModerator(_imageFile, index, callback) {
    var _file = _imageFile.path;
    let _fileToVerify = fs.readFileSync(_file);
    var options = {
        'method': 'POST',
        'url': `${config.azureServiceEndpoint}ProcessImage/Evaluate`,
        'headers': {
            'Content-Type': ['image/jpeg', 'image/jpeg'],
            'Ocp-Apim-Subscription-Key': config.Ocp_Apim_Subscription_Key
        },
        body: _fileToVerify

    };
    try {
        request(options, function (error, response) {
            if (error) throw new Error(error);

            let resBody = JSON.parse(response.body);
            if (resBody.IsImageRacyClassified == true && resBody.Result == true) {
                callback(null, { isAbusive: true, abusiveText: null, verificationMessage: `'${_imageFile.originalname}' Image seems to have some abusive content. Please use another image.`, index: index })
            } else {
                callback(null, { isAbusive: false, abusiveText: null, verificationMessage: null, index: index })
            }
        });
    } catch (error) {
        callback('Something Went Wrong', null)

    }

}

async function _ConclusionOfFrameResult(framset, callback) {
    try {
        var totalFrame = framset.length;
        var _drugs = 0;
        var _alcohol = 0;
        var _weapon = 0;
        var _nudity = {
            raw: 0,
            partial: 0,
            safe: 0
        };
        //Summation of the Modles
        let dataSet = framset.map(singleFrameResultSet => {
            return new Promise((resolve, reject) => {
                _drugs += (singleFrameResultSet.drugs);
                _alcohol += (singleFrameResultSet.alcohol);
                _weapon += (singleFrameResultSet.weapon);
                _nudity.raw += (singleFrameResultSet.nudity.raw);
                _nudity.partial += (singleFrameResultSet.nudity.partial);
                _nudity.safe += (singleFrameResultSet.nudity.safe);
                resolve(true)

            });
        });
        await Promise.all(dataSet);
        // Average of the Content 
        let nudityContent = {
            raw: (_nudity.raw) / totalFrame,
            partial: (_nudity.partial) / totalFrame,
            safe: (_nudity.safe) / totalFrame,
        };

        let drugContent = _drugs / totalFrame;
        let alcoholContent = _alcohol / totalFrame;
        let weaponContent = _weapon / totalFrame;
        let verificationMessage = null;

        if (nudityContent.raw >= Math.max(nudityContent.partial, nudityContent.safe)) {
            verificationMessage = `Video seems to have nudity content.Please check and upload another video`
        } else if (nudityContent.partial >= Math.max(nudityContent.raw, nudityContent.safe)) {
            verificationMessage = `Video seems to have nudity content eg: ${framset[0].nudity.partial_tag}. Please check and upload another video`;
        } else if (weaponContent >= Math.max(nudityContent.raw, nudityContent.partial, drugContent, alcoholContent)) {
            verificationMessage = `Video seems to have weapon content. Please check and upload another video`;
        } else if (drugContent >= Math.max(nudityContent.raw, nudityContent.partial, weaponContent, alcoholContent)) {
            verificationMessage = `Video seems to have drug content. Please check and upload another video`;
        } else if (alcoholContent >= Math.max(nudityContent.raw, nudityContent.partial, weaponContent, drugContent)) {
            verificationMessage = `Video seems to have alcohol content. Please check and upload another video`;
        }
        callback(null, verificationMessage);

    } catch (error) {
        callback(error, null);
    }


}

