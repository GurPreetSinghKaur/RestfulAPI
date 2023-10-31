//Import the express and url modules
var express = require('express');
var url = require("url");
require("dotenv").config();
const PORT = process.env.PORT || 3000;
//Status codes defined in external file
require('./http_status.js');

//The express module is a function. When it is executed it returns an app object
var app = express();

//Import the mysql module
var mysql = require('mysql');

//Create a connection object with the user details
var connectionPool = mysql.createPool({
    connectionLimit: 1,
    host: process.env.MYSQLHOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_ROOT_PASSWORD,
    database: process.env.MYSQL_USER,
    debug: false
});

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

//Set up the application to handle GET requests sent to the user path
app.get('/phone', handleGetRequest);
app.get('/phone/*', handleGetRequest);//SubFolders
app.get('/search/*', handleGetRequest);//SubFolders

//Start the app listening on port 8080
app.listen(PORT,"0.0.0.0");


/* Handles GET requests sent to web service.
   Processes path and query string and calls appropriate functions to
   return the data. */
function handleGetRequest(request, response){
    //Parse the URL
    var urlObj = url.parse(request.url, true);

    //Extract object containing queries from URL object.
    var queries = urlObj.query;

    //Get the pagination properties if they have been set. Will be  undefined if not set.
    var numItems = queries['num_items'];
    var offset = queries['offset'];
    var search = queries['search'];

    //Split the path of the request into its components
    var pathArray = urlObj.pathname.split("/");

    //Get the last part of the path
    var pathEnd = pathArray[pathArray.length - 1];


    //If path ends with 'phone' we return all phones
    if(pathEnd === 'phone'){
        getTotalPhoneCount(response, numItems, offset);//This function calls the getAllProduct function in its callback
        return;
    }

    //If path ends with search/, we return all products
    if (pathEnd === '' && pathArray[pathArray.length - 2] === 'search'){
        getSearchProduct(response, search);
        return;
    }

    //If path ends with phone/, we return all products
    if (pathEnd === '' && pathArray[pathArray.length - 2] === 'phone'){
        getTotalPhoneCount(response, numItems, offset);//This function calls the getAllProduct function in its callback
        return;
    }


    //If the last part of the path is a valid id, return data about that phone
    var regEx = new RegExp('^[0-9]+$');//RegEx returns true if string is all digits.
    if(regEx.test(pathEnd)){
        getPhone(response, pathEnd);
        return;
    }

    //The path is not recognized. Return an error message
    response.status(HTTP_STATUS.NOT_FOUND);
    response.send("{error: 'Path not recognized', url: " + request.url + "}");
}


/** Returns all of the phones, possibly with a limit on the total number of items returned and the offset (to
 *  enable pagination)*/
function getAllPhone(response, totNumItems, numItems, offset){
    //Select the products data using JOIN to convert foreign keys into useful data.
    var sql = " SELECT phone.id, image,colour, brand, model, website, phone_id, MIN(price) AS minimumPrice, websiteUrl, storage FROM phone INNER JOIN price ON phone.id = price.phone_id GROUP BY phone_id ";
    //Limit the number of results returned, if this has been specified in the query string
    if(numItems !== undefined && offset !== undefined ){
        sql += " ORDER BY id LIMIT " + numItems + " OFFSET " + offset;
    }

    //Execute the query
    connectionPool.query(sql, function (err, result) {
        //Check for errors
        if (err){
            //Not an ideal error code, but we don't know what has gone wrong.
            response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR);
            response.json({'error ': true, 'message': + err  });
            return;
        }

        //Create JavaScript object that combines total number of items with data
        var returnObj = {totNumItems: totNumItems};
        returnObj.data = result; //Array of data from database

        //Return results in JSON format
        response.json(returnObj);
    });
}


function getSearchProduct(response, search){
    let mySearch = "'%"+search+"%'";
    console.log(mySearch);
    var sql = "SELECT phone.id, price.id, brand,image, colour, model, website,  phone_id AS id, MIN(price) AS minimumPrice, websiteUrl, STORAGE FROM phone INNER JOIN price ON phone.id = price.phone_id WHERE model LIKE " + mySearch +" OR colour LIKE "+mySearch+" OR storage LIKE "+mySearch+ " GROUP BY phone_id LIMIT 15;";
    //Execute the query and call the anonymous callback function.
    connectionPool.query(sql, function (err, result) {

        //Check for errors
        if (err){
            response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR);
            response.json({'error': true, 'message': + err});
            return;
        }
        response.json(result);
    });
}

/** When retrieving all phones we start by retrieving the total number of phones
 The database callback function will then call the function to get the phone data
 with pagination */
function getTotalPhoneCount(response, numItems, offset){
    var sql = "SELECT COUNT(*) FROM phone";

    //Execute the query and call the anonymous callback function.
    connectionPool.query(sql, function (err, result) {

        //Check for errors
        if (err){
            response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR);
            response.json({'error': true, 'message': + err});
            return;
        }

        //Get the total number of items from the result
        var totNumItems = result[0]['COUNT(*)'];

        //Call the function that retrieves all products
        getAllPhone(response, totNumItems, numItems, offset);
    });
}


/** Returns the phone with the specified ID */
function getPhone(response, id){
    //Build SQL query to select phone with specified id.
    var sql = "SELECT brand, model, website, price, colour, websiteUrl, storage FROM phone INNER JOIN price ON phone.id = price.phone_id WHERE price.phone_id =" + id;
    //Execute the query
    connectionPool.query(sql, function (err, result) {
        //Check for errors
        if (err){
            response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR);
            response.json({'error': true, 'message': + err});
            return;
        }
        //Output results in JSON format
        response.json(result);
    });
}
