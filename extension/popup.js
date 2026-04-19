document.getElementById("open").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: "https://school-cashbox-sync.lovable.app/ajyal-extension" });
});
