// Display the correct tools.
chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    let currentTabURL = tabs[0].url
    let isOnBancolombiaApp = currentTabURL.split("/")[2] == "svpersonas.apps.bancolombia.com"

    // Display redirect to login page and clear local storage if not on the site or at login page
    if (!isOnBancolombiaApp || (isOnBancolombiaApp && currentTabURL.split("/").at(-1) == "autenticacion")) {
        document.getElementById("redirection").style.display = "block"
        return
    }
    
    // Process URLs
    switch (currentTabURL.split("/").at(-1)) {
        
        // Display navigation message if on Home page
        case "home":
            document.getElementById("selectAccount").style.display = "block"
            break;
        
        // Display Actions if on Movimientos Page
        case "cuentas":
            document.getElementById("movimientosActions").style.display = "block"
            let transactionType = "movimientos"
            
            // Check if request data has been stored in local storage
            chrome.storage.local.get(transactionType, (results) => {
                if (Object.keys(results) < 1) { return }
                for (let keyToCheck of ["id", "headers", "body"]) {
                    if (!Object.keys(results[transactionType]).includes(keyToCheck)) {
                        console.warn(`No ${keyToCheck} key found in ${transactionType} data. Not ready to pull data.`)
                        return
                    }
                    document.querySelector("#movimientosSelectTab").style.display = "none"
                    document.querySelector("#getMovimientos").style.display = "block"
                }
            })
            break;
        
        // Display Actions if on Transactions Page
        case "historial-transacciones":
            document.getElementById("transaccionesActions").style.display = "block"
            break;
        
        default:
            break;
    }
})



/**
 * Get all pages of transfers and store them in local storage.
 * @parm event The click event from the button.
 */
async function getTransactions(event) {
    // Detect transaction type
    let type = event.target.id == "getMovimientos"
        ? "movimientos"
        : "transacciones"

    // Set loading state
    let button = event.srcElement
    for (let attribute of ["aria-busy", "disabled"]) {
        button.setAttribute(attribute, true)
    }

    // Get request info from local storage
    let requestInfoObject = await chrome.storage.local.get(type)
    let body = requestInfoObject[type].body
    let headers = {}
    for (let header of requestInfoObject[type].headers) {
        headers[header.name] = header.value
    }

    // Get transactions from API
    let all_transactions = []
    for (let page in [...Array(10).keys()]) {
        // Cast page as number and increment
        page = Number(page) + 1
        
        // Modify request body for pagination
        type == "movimientos" ? body.pagination.key = page.toString() : body.data.detlf0210rq.location.block = page.toString()
        // Build request options
        let requestOptions = { method: "POST", headers, body: JSON.stringify(body) }
        // Make request
        let response = await fetch(
            type == "movimientos"
                ? "https://canalpersonas-ext.apps.bancolombia.com/super-svp/api/v1/security-filters/ch-ms-deposits/account/transactions"
                : "https://canalpersonas-ext.apps.bancolombia.com/super-svp/api/v1/security-filters/ds-ms-dr-lg-transactional-deposit/getFormMovements",
            requestOptions
        )

        // Handle Errors: Default is to display JSON in popup.
        if (all_transactions.length > 0 && response.code == 999) {
            // Special case when transactions are a multiple of 20.
            // An error 999 when transactions already exist means the body
            // is formatted correctly but there are no more transactions.
            break;
        }
        else if (!response.ok) {
            let error = await response.json()
            let errorMessage = null

            console.error("Failed to get transactions.", error)

            switch (Number(error.errors[0].code)) {
                // Bad Token: Need to refresh page.
                case 503:
                    errorMessage = chrome.i18n.getMessage("badTokenMessage")
                    break
                // Request Formatted Badly
                case 999:
                    errorMessage = chrome.i18n.getMessage("errorMessage")
                    break
                default:
                    errorMessage = JSON.stringify(error)
                    break
            }

            // Hide button and display error
            button.style.display = "none"
            document.querySelector("#getMovimientosError code").textContent = errorMessage
            document.querySelector("#getMovimientosError").style.display = "block";
            
            return
        }

        // Append transactions
        let {data} = await response.json()
        let transactionsFromCurrentRequest = type == "movimientos" ? data.transactions : data.detlf0210rs.productDetail
        all_transactions = all_transactions.concat(transactionsFromCurrentRequest)

        // Break if number of transactions is less than 20; no mor erecords
        if (transactionsFromCurrentRequest.length < 20) {
            break
        }
    }

    // Unset Loading State
    button.removeAttribute("aria-busy")
    button.textContent = chrome.i18n.getMessage(type == "movimientos" ? "gotMovimientosMessage" : "gotTransaccionesMessage").replace("#", all_transactions.length)
    let filename = type == "movimientos"
        ? chrome.i18n.getMessage("movimientosTitle")
        : chrome.i18n.getMessage("transaccionesTitle")
    downloadCSV(`${filename}.csv`, transactionsToCSV(all_transactions, type))
}
document.querySelector("#getMovimientos").addEventListener("click", getTransactions)
document.querySelector("#getTransacciones").addEventListener("click", getTransactions)


/**
 * Navigate to a given URL in the current tab.
 * @param {string} url 
 */
function goToURL(url) {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        console.log("CHANGING URL")
        chrome.tabs.update(tabs[0].id, { url })
    })
}
// <a> tags neither navigate to a new page in the same tab within a Chrome popup
// so we add a click event listener to change the current tabs URL ot each <a>
document.querySelectorAll("a[href]").forEach( tag => tag.addEventListener('click', _ => goToURL(tag.href)))



/**
 * Converts transactions to CSV string.
 * 
 * Sample Transfer Format
{
    "valueDate": null,
    "transactionDate": "2025/08/16",
    "trackingId": null,
    "id": null,
    "description": "COMPRA INTL ROBERTSINGL",
    "amount": -4048.74,
    "type": "CREDITO",
    "reference1": "",
    "reference2": null,
    "reference3": null,
    "checkNumber": null,
    "office": {
        "code": null,
        "name": "CC. SANTAFE MEDELLIN"
    },
    "relatedTransferAccount": null
}
 * 
 * Sample Transaction Format
    {
        "date": { "dateName": "FECNOT", "dateValue": "2025/08/14" },
        "balance": { "currency": "COP", "desc": "", "name": "VALOR", "value": "200000.00" },
        "details": [
            { "name": "TIPO", "value": "CR" },
            { "name": "DESCRIPTION", "value": "Transferencia de fondos por SUCURSAL VIRTUAL del producto 9 12-81455121" },
            { "name": "COMISION", "value": "0" }
        ]
    }
 * 
 * @param {Array[Object]} transactions An array of objects representing transactions.
 * @returns {String} A string with \n line endings representing the CSV.
 */
function transactionsToCSV(transactions, type) {
    // Validate Transactions
    if (!Array.isArray(transactions) || transactions.length < 1) {
        console.error("Transactions must be an array of 1 or more objects.")
        return
    }

    // Validate Type
    let validTypes = ["movimientos", "transacciones"]
    if (!validTypes.includes(type)) {
        console.error(`Type ${type} is not a valid type. Must be one of: ${validTypes.map(type => `'${type}'`).join(" | ")}`)
        return
    }

    // Transform Transactions
    let rows = transactions.map( transaction => {
        return {
            [chrome.i18n.getMessage("transactionHeaderDate")]: type == "movimientos" ? transaction.transactionDate : transaction.date.dateValue,
            [chrome.i18n.getMessage("transactionHeaderStatus")]: chrome.i18n.getMessage("transactionStatusReconciled"),
            [chrome.i18n.getMessage("transactionHeaderType")]: type == "movimientos" 
                                                                    // Movimientos flip CREDITO and DEBITO logic.
                                                                    ? transaction.type == "CREDITO" 
                                                                        ? chrome.i18n.getMessage("transactionTypeWithdrawal") 
                                                                        : chrome.i18n.getMessage("transactionTypeDepost") 
                                                                    // Transferencias can or CR or DB.
                                                                    : transaction.details[0].value == "CR" 
                                                                        ? chrome.i18n.getMessage("transactionTypeDepost") 
                                                                        : chrome.i18n.getMessage("transactionTypeWithdrawal"),
            [chrome.i18n.getMessage("transactionHeaderAmount")]: Math.abs(Number( 
                                                                        type == "movimientos" 
                                                                            ? transaction.amount 
                                                                            : transaction.balance.value 
                                                                )),
            [chrome.i18n.getMessage("transactionHeaderPayee")]: type == "movimientos" ? transaction.description : transaction.details[1].value,
            [chrome.i18n.getMessage("transactionHeaderCategory")]: "",
            [chrome.i18n.getMessage("transactionHeaderNumber")]: "",
            [chrome.i18n.getMessage("transactionHeaderNote")]: "",
            [chrome.i18n.getMessage("transactionHeaderBalance")]: "",
            [chrome.i18n.getMessage("transactionHeaderAccount")]: "",
        }
    })
    // Get CSV Headers from First Transaction
    let headers = Object.keys(rows[0]).join(",")

    let csvString = `${headers}\n${rows.map( row => Object.values(row).join(",")).join("\n")}`
    return csvString
}



/**
 * Download a CSV string as a CSV file.
 * @param {String} filename The name of the file to be downloaded.
 * @param {String} csvString The CSV data.
 */
function downloadCSV(filename, csvString) {
    chrome.downloads.download({ url: 'data:text/csv;base64,' + btoa(csvString), filename })
}



// For translation, all elements with a data-i18n-id will have their text value set
// to the result of chrome.i18n.getMessage(element.data-i18n-id)
document.querySelectorAll("[data-i18n-id]").forEach( element => { 
    element.textContent = chrome.i18n.getMessage(element.dataset.i18nId)
})