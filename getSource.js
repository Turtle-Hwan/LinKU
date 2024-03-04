function get_source(document_body){
  return document_body.innerText;
}

chrome.runtime.sendMessage(null, {
  action: "getSource",
  source: document.body.innerHTML
});