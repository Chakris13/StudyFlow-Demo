function updateClock(){
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, 0);
    const minute = now.getMinutes().toString().padStart(2, 0);
    const second = now.getSeconds().toString().padStart(2, 0);
    const days = now.getDate().toString();
    const monthNumber = (now.getMonth() + 1).toString();
    const year = now.getFullYear().toString();
    const timeStr = `${hours}:${minute}:${second} ${days}/${monthNumber}/${year}`;
    document.getElementById("clock").textContent = timeStr;
}

updateClock();
setInterval(updateClock, 1000);