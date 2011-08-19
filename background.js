var cpan_url = 'https://metacpan.org';

// Click from Browser Action Icon
chrome.browserAction.onClicked.addListener(function(tab) {
    selectOrCreateTab(cpan_url);
});

// Config of search box
chrome.omnibox.onInputEntered.addListener(
    function(text){
        searchOnCPAN(text);
    }
);

// Suggest of inputting
chrome.omnibox.onInputChanged.addListener(
    function(text, suggest){
        var obj = getSuggestions(text);
        var suggestions = [];
        for ( var i = 0, len = obj.length; i < len; i++ ) {
            var tmp = {
                content: obj[i].documentation,
                description: obj[i].documentation + ' ' + obj[i].author + '/' + obj[i].release
            };
            suggestions.push(tmp);
        }
        suggest(suggestions);
    }
);

// Config of context menu
chrome.contextMenus.create({
    title: 'Search the CPAN',
    contexts: ['selection'],
    onclick: function(info, tab){
        var text = info.selectionText;
        searchOnCPAN(text);
    }
});

/*
 * Get suggestions from metacpan.org
 */
function getSuggestions(text){
    var query = cpan_url + '/search/autocomplete?q=' + text;
    var xhr = new XMLHttpRequest();
    xhr.open("GET", query, false);
    xhr.send();
    return JSON.parse(xhr.responseText);
}

/*
 * Search on metacpan.org
 */
function searchOnCPAN(text){
    var obj = getSuggestions(text);
    var path = text == obj[0].documentation ? '/module/' : '/search?q=';
    var target_url = encodeURI(cpan_url + path + text);
    selectOrCreateTab(target_url);
}

/*
 * Create tab
 */
function selectOrCreateTab(url){
    chrome.tabs.getAllInWindow(null, function(tabs){
        for ( var i = 0, len = tabs.length; i < len; i++ ) {
            if ( tabs[i].url == url ) {
                chrome.tabs.update(tabs[i].id, { selected: true });
                return;
            }
        }
        chrome.tabs.create({ url: url });
    });
}

// Default settings
if ( !localStorage.getItem('settings') ) {
    var settings = {
        notify: true,
        display: 10,
    };
    localStorage.setItem('settings', JSON.stringify(settings));
}

/*
 * Check CPAN release
 */
var notified = {};
google.load("feeds", "1");
function loadFeed() {
    var feed = new google.feeds.Feed("http://frepan.org/feed/index.rss");
    feed.load(function(result) {
        if (!result.error) {
            for (var i = 0; i < result.feed.entries.length; i++) {
                var entry = result.feed.entries[i];
                entry.content.match(/img src="([^"]+)"/);
                var image = RegExp.$1;

                var settings = JSON.parse(localStorage.getItem('settings'));
                if (settings.notify) {
                    if (!notified[entry.title]) {
                        notify(image, entry.title, entry.contentSnippet, entry.link, settings.display);
                        notified[entry.title] = true;
                    }
                }
            }
        }
    });
    //Run again next interval
    setTimeout(loadFeed, 10000);  //
}
// Once the Google Feeds API starts check the feeds
google.setOnLoadCallback(loadFeed);

/*
 * Notify desktop
 */
function notify(image_url, title, message, link, display){
    // Check permission
    if ( webkitNotifications.checkPermission() == 0 ) {
        var popup = webkitNotifications.createNotification(image_url, title, message);
        popup.ondisplay = function(){
            setTimeout(function(){
                popup.cancel();
            }, display * 1000);
        };
        popup.onclick = function(){
            selectOrCreateTab(link);
            popup.cancel();
        };
        popup.show();
    } else {
        // Request permission
        webkitNotifications.requestPermission();
    }
}
