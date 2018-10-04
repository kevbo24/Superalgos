﻿exports.newExchangeAPI = function newExchangeAPI(bot, logger) {

    /*

    This module allows trading bots to connect to the exchange and do trading operations on it. So far it can only work with Poloniex.

    */
    const _ = require('lodash');
    const isValidOrder = require('./exchangeUtils').isValidOrder;
    const graphqlClient = require('graphql-client')
    const request = require('request')
    const authOptions = require('./Auth0')

    let MODULE_NAME = "Exchange API";

    let thisObject = {
        initialize: initialize,
        getTicker: getTicker,
        getOpenPositions: getOpenPositions,
        getExecutedTrades: getExecutedTrades,
        putPosition: putPosition,
        movePosition: movePosition,
        getPublicTradeHistory: getPublicTradeHistory,
        getExchangeProperties: getExchangeProperties,
        getMaxDecimalPositions: getMaxDecimalPositions
    };

    let apiClient;

    return thisObject;

    function initialize(callBackFunction) {
        try {

            if (global.LOG_CONTROL[MODULE_NAME].logInfo === true) { logger.write(MODULE_NAME, "[INFO] initialize -> Entering function."); }

            // TODO integrate with financial beings module to get the exchange
            let botExchange = 'Poloniex';
            let exchange = botExchange.toLowerCase() + 'Client.js';
            let api = require('./Wrappers/' + exchange);
            
            request(authOptions, onTokenResponse);

            function onTokenResponse(error, response, body) {
                if (global.LOG_CONTROL[MODULE_NAME].logInfo === true) { logger.write(MODULE_NAME, "[INFO] onTokenResponse -> Entering function."); }

                if (error) {
                    logger.write(MODULE_NAME, "[ERROR] onTokenResponse -> err = " + error.message);
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                } else {
                    if (global.LOG_CONTROL[MODULE_NAME].logInfo === true) { logger.write(MODULE_NAME, "[INFO] onTokenResponse -> Token Received."); }
                    let response = JSON.parse(body)
                    let authToken = response.access_token
                    let keyVaultAPI = createKeyVaultAPIClient(authToken)
                    apiClient = api.newAPIClient(keyVaultAPI, logger);

                    callBackFunction(global.DEFAULT_OK_RESPONSE);
                }
            }
        } catch (err) {
            logger.write(MODULE_NAME, "[ERROR] initialize -> err = " + err.message);
            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
        }
    }

    function createKeyVaultAPIClient(authToken) {
        if (global.LOG_CONTROL[MODULE_NAME].logInfo === true) { logger.write(MODULE_NAME, "[INFO] createKeyVaultAPIClient -> Entering function."); }

        const keyVaultAPI = graphqlClient({
            //url: 'http://localhost:4002/graphql', TODO Move to properties
            url: 'https://keyvault-api.advancedalgos.net/graphql',
            headers: {
                Authorization: 'Bearer ' + authToken
            }
        });

        keyVaultAPI.signTransaction = function (transaction, next) {
            let variables = {
                botId: bot.displayName,
                transaction: transaction
            }

            keyVaultAPI.query(`
                mutation($botId: String, $transaction: String!){
                signTransaction(botId: $botId, transaction: $transaction){
                    key,
                    signature,
                    date
                }
                }`, variables, function (req, res) {
                if (res.status === 401) {
                    next(undefined, 'Error from graphql: Not authorized');
                }
            }).then(res => {
                if (res.errors) {
                    next(undefined, 'Error from graphql: ' + res.errors);
                } else {
                    let signature = {
                        Key: res.data.signTransaction.key,
                        Sign: res.data.signTransaction.signature
                    }
                    next(signature)
                }
            }).catch(error => {
                next(undefined, 'Error signing the message on the key vault: ' + error.message);
            });
        }

        if (global.LOG_CONTROL[MODULE_NAME].logInfo === true) { logger.write(MODULE_NAME, "[INFO] createKeyVaultAPIClient -> Returning graphql client."); }

        return keyVaultAPI;
    }

    /*
     *  Position Object = {
     *           id,        String
     *           type,      String
     *           rate,      Number
     *           amountA,   Number
     *           amountB,   Number
     *           fee,       Number
     *           datetime   Date
     *       };
     */
    function truncDecimals(pFloatValue) {
        let decimals = getMaxDecimalPositions();
        return parseFloat(parseFloat(pFloatValue).toFixed(decimals));
    }

    /*
     * Return number of decimals for the current market
     */
    function getMaxDecimalPositions() {
        return getMarketConfig().maxDecimals;
    }

    /*
     * Return number of decimals for the current market
     */
    function getMarketConfig() {
        return _.find(getExchangeProperties().markets, (p) => {
            return _.first(p.pair) === global.MARKET.assetA.toUpperCase() &&
                _.last(p.pair) === global.MARKET.assetB.toUpperCase();
        });
    }

    /*
     * Return number of decimals for the current market
     */
    function getExchangeProperties() {
        try {

            if (global.LOG_CONTROL[MODULE_NAME].logInfo === true) { logger.write(MODULE_NAME, "[INFO] getExchangeProperties -> Entering function."); }

            return apiClient.getExchangeProperties();

        } catch (err) {
            logger.write(MODULE_NAME, "[ERROR] getExchangeProperties -> err = " + err.message);
            callBack(global.DEFAULT_FAIL_RESPONSE);
        }
    }

    /*
     * Returns the price for a given pair of assets.
     * The object returned is an array of trades:
     * ticker = {
     *           bid, Number
     *           ask, Number
     *           last Number
     *       };
     */
    function getTicker(pMarket, callBack) {
        try {

            if (global.LOG_CONTROL[MODULE_NAME].logInfo === true) { logger.write(MODULE_NAME, "[INFO] getTicker -> Entering function."); }

            apiClient.getTicker(pMarket, callBack);

        } catch (err) {
            logger.write(MODULE_NAME, "[ERROR] getTicker -> err = " + err.message);
            callBack(global.DEFAULT_FAIL_RESPONSE);
        }
    }

    /*
     * Returns the open positions ath the exchange for a given market and user account.
     * The object returned is an array of positions
     *
     */
    function getOpenPositions(pMarket, callBack) {
        try {

            if (global.LOG_CONTROL[MODULE_NAME].logInfo === true) { logger.write(MODULE_NAME, "[INFO] getOpenPositions -> Entering function."); }
            if (global.LOG_CONTROL[MODULE_NAME].logInfo === true) { logger.write(MODULE_NAME, "[INFO] getOpenPositions -> pMarket = " + JSON.stringify(pMarket)); }

            apiClient.getOpenPositions(pMarket, callBack);

        } catch (err) {
            logger.write(MODULE_NAME, "[ERROR] getOpenPositions -> Error = " + err.message);
            callBack(global.DEFAULT_FAIL_RESPONSE);
        }
    }

    /*
     * Returns the trades for a given order number.
     * The object returned is an array of positions
     */
    function getExecutedTrades(pPositionId, callBack) {
        try {

            if (global.LOG_CONTROL[MODULE_NAME].logInfo === true) { logger.write(MODULE_NAME, "[INFO] getExecutedTrades -> Entering function."); }
            if (global.LOG_CONTROL[MODULE_NAME].logInfo === true) { logger.write(MODULE_NAME, "[INFO] getExecutedTrades -> pPositionId = " + pPositionId); }

            apiClient.getExecutedTrades(pPositionId, callBack);

        } catch (err) {
            logger.write(MODULE_NAME, "[ERROR] getExecutedTrades -> Error = " + err.message);
            callBack(global.DEFAULT_FAIL_RESPONSE);
        }
    }

    /*
     * Creates a new buy or sell order.
     * The orderNumber is returned. String
     */
    function putPosition(pMarket, pType, pRate, pAmountA, pAmountB, callBack) {
        try {

            if (global.LOG_CONTROL[MODULE_NAME].logInfo === true) { logger.write(MODULE_NAME, "[INFO] putPosition -> Entering function."); }
            if (global.LOG_CONTROL[MODULE_NAME].logInfo === true) { logger.write(MODULE_NAME, "[INFO] putPosition -> pMarket = " + JSON.stringify(pMarket)); }
            if (global.LOG_CONTROL[MODULE_NAME].logInfo === true) { logger.write(MODULE_NAME, "[INFO] putPosition -> pType = " + pType); }
            if (global.LOG_CONTROL[MODULE_NAME].logInfo === true) { logger.write(MODULE_NAME, "[INFO] putPosition -> pRate = " + truncDecimals(pRate)); }
            if (global.LOG_CONTROL[MODULE_NAME].logInfo === true) { logger.write(MODULE_NAME, "[INFO] putPosition -> pAmountA = " + truncDecimals(pAmountA)); }
            if (global.LOG_CONTROL[MODULE_NAME].logInfo === true) { logger.write(MODULE_NAME, "[INFO] putPosition -> pAmountB = " + truncDecimals(pAmountB)); }

            let check = isValidOrder({
                market: getMarketConfig(),
                api: apiClient,
                amount: truncDecimals(pAmountB),
                price: truncDecimals(pRate)
            });

            if (check.valid) {
                if (pType === "buy") {
                    apiClient.buy(pMarket.assetA, pMarket.assetB, truncDecimals(pRate), truncDecimals(pAmountB), callBack);
                    return;
                }

                if (pType === "sell") {
                    apiClient.sell(pMarket.assetA, pMarket.assetB, truncDecimals(pRate), truncDecimals(pAmountB), callBack);
                    return;
                }

                logger.write(MODULE_NAME, "[ERROR] putPosition -> pType must be either 'buy' or 'sell'.");
                callBack(global.DEFAULT_FAIL_RESPONSE);

            } else {
                logger.write(MODULE_NAME, "[ERROR] putPosition -> The order is invalid: " + check.reason);
                callBack(global.DEFAULT_FAIL_RESPONSE);
            }

        } catch (err) {
            logger.write(MODULE_NAME, "[ERROR] putPosition -> err = " + err.message);
            callBack(global.DEFAULT_FAIL_RESPONSE);
        }
    }

    /*
     * Move an existing position to the new rate.
     * The new orderNumber is returned.
     */
    function movePosition(pPosition, pNewRate, pNewAmountB, callBack) {
        try {

            if (global.LOG_CONTROL[MODULE_NAME].logInfo === true) { logger.write(MODULE_NAME, "[INFO] movePosition -> Entering function."); }
            if (global.LOG_CONTROL[MODULE_NAME].logInfo === true) { logger.write(MODULE_NAME, "[INFO] movePosition -> pPosition = " + JSON.stringify(pPosition)); }
            if (global.LOG_CONTROL[MODULE_NAME].logInfo === true) { logger.write(MODULE_NAME, "[INFO] movePosition -> pNewRate = " + truncDecimals(pNewRate)); }

            apiClient.movePosition(pPosition, truncDecimals(pNewRate), truncDecimals(pNewAmountB), callBack);

        } catch (err) {
            logger.write(MODULE_NAME, "[ERROR] movePosition -> err = " + err.message);
            callBack(global.DEFAULT_FAIL_RESPONSE);
        }
    }

    /*
     * Returns all the trade history from the Exchange since startTime to endTime orderd by tradeId.
     * It's possible that the exchange doesn't support this method.
     * The object returned is an array of trades:
     * trade = {
     *           tradeID,       String
     *           globalTradeID, String
     *           type,          String
     *           rate,          Number
     *           amountA,       Number
     *           amountB,       Number
     *           date       Date
     *       };
     */
    function getPublicTradeHistory(assetA, assetB, startTime, endTime, callBack) {
        try {

            if (global.LOG_CONTROL[MODULE_NAME].logInfo === true) { logger.write(MODULE_NAME, "[INFO] getTradeHistory -> Entering function."); }

            apiClient.getPublicTradeHistory(assetA, assetB, startTime, endTime, callBack);

        } catch (err) {
            logger.write(MODULE_NAME, "[ERROR] getTradeHistory -> err = " + err.message);
            callBack(global.DEFAULT_FAIL_RESPONSE);
        }
    }
};
