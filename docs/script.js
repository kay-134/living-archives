//Javascript Function that changes a CSS property -> Mobile Nav which changes the style of the mobile header
//Hamburger menu -> 3 line svg which changes coolor on hover & reveals the navagation links
//A JS function that changes the main page photo everyday
//Javascript Function that changes text -> changes the time live on the website



// Creates a variable to store current hour (0-23)
// With he variable "hour", 0 correlates to 12 am
let hour = new Date().getHours();
let minute = new Date().getMinutes();
let day = new Date().getDay();
console.log("Hours: ", hour, minute);
    

// Creates DOM queries 
// - element with id "timeofhour" -> changes the time in the nav bar
// - element with id "message" -> to update message
// - element with id "homePhoto" -> update the home photo depending on the day of the week
let timeofhour = document.getElementById("timeofhour");
let message = document.getElementById("message");
let homePhoto = document.querySelector("#homePhoto");
let title = document.getElementById("title");

// Center-align the heading using javascript
message.style.textAlign = "center";

// Write conditional logic
// if daytime (hour is between 6 and 18)
function clock() {
    minute = new Date().getMinutes();
    hour = new Date().getHours();
    
    //allows the time to have a 0:00 format even when the minute number is under 10
    if (minute < 10){
        minute = "0" + minute;
    }


    //making sure that when it's 12 am it shows as 12
    if (hour == 0){
      timeofhour.textContent = "12" + ":" + minute + " am";
    }

    //for every other time that is over 0 but under 12 to account for all the morning times
    else if (hour <= 11 && hour != 0){
        timeofhour.textContent = (hour) + ":" + minute + " am";
    }

    //for all the afternoon times
    else if (hour == 12) {
        timeofhour.textContent = (hour) + ":" + minute + " pm";
    }
    
    else{
        timeofhour.textContent = (hour-12) + ":" + minute + " pm";
    }
}

//changes the main page photo depending on the day of the week
function photoOfTheDay(){
    //Sunday
    if (day > 3){
        homePhoto.src = "./images/me5/me-1500.png";
        homePhoto.srcset = "./images/me5/me-3000.png 2x, ./images/me5/me-4500.png 3x";
    
    }
    //Tuesday
    if (day <= 3){
        homePhoto.src = "./images/me1/me-1500.png";
        homePhoto.srcset = "./images/me1/me1-3000.png 2x, ./images/me1/me1-4500.png 3x";
    }

    console.log("changed");
}

//a function that only displays the nav options for mobile when the hamburger menu is pressed & changes the style of the title of the website in mobile view
function mobileNav(){
    var x = document.querySelector(".links");
    title.style.fontStyle = "none";
    if (x.style.display === "block") {
        x.style.display = "none";
        title.style.fontStyle = "normal";
    } else {
        x.style.display = "block";
        title.style.fontStyle = "italic";
    }
  
}

function cornmealPudding() {
  var x = document.getElementById("cornmeal");
  if (x.style.display === "none") {
    x.style.display = "block";
  } else {
    x.style.display = "none";
  }
}
function toto() {
  var x = document.getElementById("toto");
  if (x.style.display === "none") {
    x.style.display = "block";
  } else {
    x.style.display = "none";
  }
}
//running clock & photo of the day functions
//setInterval(clock, 100);

//waiting for all DOM content to load before running functions
window.addEventListener('DOMContentLoaded', function () {
    setInterval(clock, 100);
    photoOfTheDay();
});
