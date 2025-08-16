console.log(`Hello from service worker!`);

let urlFilters = [
    // Movimientos API Call
    "https://canalpersonas-ext.apps.bancolombia.com/super-svp/api/v1/security-filters/ch-ms-deposits/account/transactions",
    // Transactions API Call 
    "https://canalpersonas-ext.apps.bancolombia.com/super-svp/api/v1/security-filters/ds-ms-dr-lg-transactional-deposit/getFormMovements"
];

chrome.webRequest.onBeforeRequest.addListener(
    async function (details) {
        // Get the call type
        let callType = details.url == urlFilters[0] ? "movimientos" : "transacciones"

        // Get the request ID
        let id = details.requestId

        // Get the request body
        let decoder = new TextDecoder("utf-8")
        let body = JSON.parse(decoder.decode(details.requestBody.raw[0].bytes))
        
        // Update call details in local storage
        chrome.storage.local.set({
            [callType]: {id, body}
        })
        
        return details;
    },
    { urls: urlFilters },
    ["requestBody"]
);

chrome.webRequest.onBeforeSendHeaders.addListener(
    async function (details) {
        // Get the call type
        let callType = details.url == urlFilters[0] ? "movimientos" : "transacciones"

        // Get the request ID
        let id = details.requestId

        // Get the request body
        let headers = details.requestHeaders
        
        // Update call details in local storage
        let currentData = await chrome.storage.local.get(callType)

        if (id != currentData[callType].id) {
            return details
        } else {
            chrome.storage.local.set({
                [callType]: {...currentData[callType], headers}
            })
        }

        return details;
    },
    { urls: urlFilters },
    ["requestHeaders"]
);