const login = document.querySelector("#form");
login.addEventListener("submit", (e) => {
  e.preventDefault();
  const user = document.querySelector("#username").value;
  if (user != "") {
    document.cookie = `username=${user}`;
    document.location.href = "/";
  } else {
    alert("Please enter a username");
  }
});
