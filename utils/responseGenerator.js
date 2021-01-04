exports.getResponse = function (status, data = null, erroMsg = null) {

    var response = {
        "Status": status,
        "Data": data,
        "ErrorMessage": erroMsg,
    }
    return response;
}