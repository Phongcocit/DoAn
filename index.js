const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const io = require("socket.io")(server);
const exphbs = require("express-handlebars");
const admin = require("firebase-admin");
const bodyParser = require("body-parser");
const serviceAccount = require("./tom.json");
const session = require("express-session");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
// Middleware for checking authentication
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    res.redirect("/dangnhap");
  } else {
    next();
  }
};
app.use(
  session({
    secret: "session",
    resave: false,
    saveUninitialized: true,
  })
);
// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://test-5a353-default-rtdb.firebaseio.com",
});

// Set up Handlebars view engine
app.engine(
  "handlebars",
  exphbs({
    defaultLayout: null,
  })
);
app.set("view engine", "handlebars");

// Set up static files
app.use(express.static("public"));

// Create a transporter to send emails
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "floodwarning1105@gmail.com",
    pass: "glhpwnprnxnclvzc",
  },
});
function sendEmail(to, subject, text) {
  const mailOptions = {
    from: "floodwarning1105@gmail.com",
    to,
    subject,
    text,
  };
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log("Error sending email:", error);
    } else {
      console.log("Email sent:", info.response);
    }
  });
}

// Get a database reference
const db = admin.database();
const ref = db.ref("IoT");

// Declare global variables
let ph, temperature, Turbidity, tds;

// Listen for value changes in Firebase Realtime Database
ref.on("value", (snapshot) => {
  const data = snapshot.val();
  const now = new Date().toISOString();

  // Extract values from the snapshot
  ph = data.PH;
  temperature = data.Temperature;
  Turbidity = data.Turbidity;
  tds = data.tds;
  //warning = data.Muc_canh_bao;
  // console.log(data);
  // Send values to all connected clients
  io.emit("data", { ph, temperature, Turbidity, tds });
});

io.on("connection", (socket) => {
  // Send latest values to the new client
  socket.emit("data", { ph, temperature, Turbidity, tds });
});

// Set the interval to 10 minutes
setInterval(() => {
  const date = new Date();
  const options = {
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };
  const timeString = date.toLocaleTimeString("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false,
  });
  const dateString = date.toLocaleString("en-US", options);

  // Ghép chuỗi ngày và giờ lại với nhau
  const dateTimeString = dateString + " " + timeString;
  // Add the data to the "history" node in Firebase Realtime Database
  const historyRef = db.ref("history");
  const limit = 1;
  // console.log(tds);
  historyRef
    .orderByChild("datetime")
    .limitToLast(limit)
    .once("value")
    .then((snapshot) => {
      let dataExists = false;
      snapshot.forEach((childSnapshot) => {
        const childData = childSnapshot.val();

        if (
          childData.ph === ph &&
          childData.temperature === temperature &&
          childData.Turbidity === Turbidity &&
          childData.tds === tds

          //childData.warning === warning
        ) {
          dataExists = true;
          console.log("Cảm biến chưa được bật, không thể truy xuất dữ liệu");
        }
      });

      if (!dataExists) {
        console.log(ph);
        // Thêm dữ liệu mới vào Firebase Realtime Database
        historyRef.push(
          {
            ph: ph,
            temperature: temperature,
            Turbidity: Turbidity,
            tds: tds,
            //warning: warning,
            time: timeString,
            date: dateString,
            datetime: dateTimeString,
          },
          (err) => {
            if (err) {
              console.error(err);
            } else {
              console.log("Lưu dữ liệu vào Firebase Realtime Database");
            }
          }
        );
      }
    })
    .catch((err) => {
      console.error(err);
    });
  //   if (ph === 3) {
  //     // Get a list of all users with registered email addresses
  //     const usersRef = db.ref('users');
  //     usersRef.orderByChild('email').on('value', (snapshot) => {
  //       const users = snapshot.val();
  //       // Send email notification to each user
  //       Object.keys(users).forEach((userId) => {
  //         const user = users[userId];
  //         if (user.email) {
  //           sendEmail(user.email, 'cảnh báo', `Chào ${user.username},
  // Mực nước đang ở mức báo động, cảnh báo đang ở mức level ${warning},
  // Khoảng cách hiện tại ${average} cm, bạn cần di tản gấp
  // Thời điểm ghi nhận  ${timeString},ngày ${dateString}`);
  //         }
  //       });
  //     });
  //   }
}, 60 * 10 * 1000);

// Route for homepage
app.get("/", (req, res) => {
  const user = req.session.user;
  const username = user?.username;
  res.render("home", { username });
});

// Route for introducing page
app.get("/gioithieu", requireAuth, (req, res) => {
  const user = req.session.user;
  const username = user.username;
  res.render("gioithieu", { username });
});
app.get("/cambien", requireAuth, (req, res) => {
  const user = req.session.user;
  const username = user.username;
  res.render("cambien", { username });
});
app.get("/settime", requireAuth, (req, res) => {
  const user = req.session.user;
  const username = user.username;
  res.render("settime", { username });
});

// Route for chart page
app.get("/charts", requireAuth, (req, res) => {
  const user = req.session.user;
  const username = user.username;
  const historyRef = db.ref("history");
  // Lấy dữ liệu từ Firebase Realtime Database, sắp xếp theo thời gian và giới hạn 2 bản ghi cuối cùng
  historyRef
    .orderByChild("datetime")
    .limitToLast(2)
    .once("value", (snapshot) => {
      const data = snapshot.val();
      const historyArr = Object.values(data);
      const latestDistance = historyArr[1].ph; // Lấy dữ liệu gần nhất
      console.log(historyArr[1].ph)
      const secondLatestDistance = historyArr[0].ph; // Lấy dữ liệu gần thứ hai
      const warning = historyArr[1].ph;
      const difference = latestDistance - secondLatestDistance; // Tính toán chênh lệch
      // Render template và truyền dữ liệu vào view
      res.render("charts", { username, latestDistance, warning, difference });
    });
});
//tds
app.get("/tds", requireAuth, (req, res) => {
  const user = req.session.user;
  const username = user.username;
  const historyRef = db.ref("history");
  // Lấy dữ liệu từ Firebase Realtime Database, sắp xếp theo thời gian và giới hạn 2 bản ghi cuối cùng
  historyRef
    .orderByChild("datetime")
    .limitToLast(2)
    .once("value", (snapshot) => {
      const data = snapshot.val();
      const historyArr = Object.values(data);
      const latestDistance = historyArr[1].tds; // Lấy dữ liệu gần nhất
      console.log(historyArr[1].tds)
      const secondLatestDistance = historyArr[0].tds; // Lấy dữ liệu gần thứ hai
      const warning = historyArr[1].tds;
      console.log("ooooooo")
      console.log(historyArr[0].tds)
      const difference = latestDistance - secondLatestDistance; // Tính toán chênh lệch
      // Render template và truyền dữ liệu vào view
      res.render("tds", { username, latestDistance, warning, difference });
    });
});
//turbidity
app.get("/turbidity", requireAuth, (req, res) => {
  const user = req.session.user;
  const username = user.username;
  const historyRef = db.ref("history");
  // Lấy dữ liệu từ Firebase Realtime Database, sắp xếp theo thời gian và giới hạn 2 bản ghi cuối cùng
  historyRef
    .orderByChild("datetime")
    .limitToLast(2)
    .once("value", (snapshot) => {
      const data = snapshot.val();
      const historyArr = Object.values(data);
      const latestDistance = historyArr[1].Turbidity; // Lấy dữ liệu gần nhất
      console.log(historyArr[1].Turbidity)
      const secondLatestDistance = historyArr[0].Turbidity; // Lấy dữ liệu gần thứ hai
      const warning = historyArr[1].Turbidity;
      const difference = latestDistance - secondLatestDistance; // Tính toán chênh lệch
      // Render template và truyền dữ liệu vào view
      res.render("turbidity", { username, latestDistance, warning, difference });
    });
});
//temperature
app.get("/temperature", requireAuth, (req, res) => {
  const user = req.session.user;
  const username = user.username;
  const historyRef = db.ref("history");
  // Lấy dữ liệu từ Firebase Realtime Database, sắp xếp theo thời gian và giới hạn 2 bản ghi cuối cùng
  historyRef
    .orderByChild("datetime")
    .limitToLast(2)
    .once("value", (snapshot) => {
      const data = snapshot.val();
      const historyArr = Object.values(data);
      const latestDistance = historyArr[1].temperature; // Lấy dữ liệu gần nhất
      console.log(historyArr[1].temperature)
      const secondLatestDistance = historyArr[0].temperature; // Lấy dữ liệu gần thứ hai
      const warning = historyArr[1].temperature;
      const difference = latestDistance - secondLatestDistance; // Tính toán chênh lệch
      // Render template và truyền dữ liệu vào view
      res.render("temperature", { username, latestDistance, warning, difference });
    });
});
// Route for chart data
app.get("/charts-data", (req, res) => {
  const historyRef = db.ref("history");

  // Get the data from Firebase Realtime Database
  historyRef.once("value", (snapshot) => {
    const data = snapshot.val();
    res.json(data);
  });
});

// Parse incoming request bodies in a middleware before your handlers, available under the req.body property.
app.use(bodyParser.urlencoded({ extended: true }));
// Route for registration form
app.get("/dangky", (req, res) => {
  res.render("dangky");
});
// Route for handling registration form submission

app.post("/dangky", async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;
    // Check if username already exists in Firebase Realtime Database
    const ref = db.ref("users");
    const snapshot = await ref
      .orderByChild("username")
      .equalTo(username)
      .once("value");
    const emailSnapshot = await ref
      .orderByChild("email")
      .equalTo(email)
      .once("value");
    if (snapshot.exists() && emailSnapshot.exists()) {
      res.send({
        success: false,
        message: "Tên đăng nhập và Email đã được đăng ký",
      });
    } else if (snapshot.exists()) {
      res.send({ success: false, message: "Tên đăng nhập đã được đăng ký" });
    } else if (emailSnapshot.exists()) {
      res.send({ success: false, message: "Email đã được đăng ký" });
    } else {
      // Hash password with bcrypt
      const hashedPassword = await bcrypt.hash(password, 10);
      // Create new user in Firebase Realtime Database
      const userRef = ref.push({
        username,
        email,
        password: hashedPassword, // Store hashed password in database
      });
      console.log(`User ${username} with ID ${userRef.key} created`);
      res.send({ success: true, message: "Đăng ký thành công" });
    }
  } catch (error) {
    console.error("Error registering user:", error);
    res.send({ success: false, message: "Lỗi đăng ký" });
  }
});
// Route for login form
app.get("/dangnhap", (req, res) => {
  res.render("dangnhap");
});

// Route for handling login form submission
app.post("/dangnhap", async (req, res) => {
  try {
    const { username, password } = req.body;
    // Check if username exists in Firebase Realtime Database
    const ref = db.ref("users");
    const snapshot = await ref
      .orderByChild("username")
      .equalTo(username)
      .once("value");
    if (snapshot.exists()) {
      const user = snapshot.val()[Object.keys(snapshot.val())[0]]; // Get the first user with matching username
      // Compare hashed password with entered password using bcrypt
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        console.log(`User ${username} logged in`);
        req.session.user = { id: user.id, username: user.username };
        res.send({ success: true, message: "Đăng nhập thành công" }); // send response as JSON
      } else {
        res.send({ success: false, message: "Mật khẩu không chính xác" });
      }
    } else {
      res.send({ success: false, message: "Người dùng không tồn tại" });
    }
  } catch (error) {
    console.error("Error logging in user:", error);
    res.send({ success: false, message: "Error logging in user" });
  }
});

// Route for logout button
app.get("/logout", (req, res) => {
  // Delete session users
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
    } else {
      // homepage
      res.redirect("/");
    }
  });
});

// Route for history page
app.get("/history", requireAuth, (req, res) => {
  const historyRef = db.ref("history");
  historyRef.once("value", (snapshot) => {
    const historyData = snapshot.val();
    const user = req.session.user;
    const username = user?.username;
    res.render("history", { historyData, username: username });
  });
});
// Route to handle delete requests
app.post("/history/delete", requireAuth, (req, res) => {
  const keys = req.body.keys;
  const promises = [];

  if (!keys || !Array.isArray(keys)) {
    res.redirect("/history");
    return;
  }
  keys.forEach((key) => {
    const historyRef = db.ref("history/" + key);
    promises.push(historyRef.remove());
  });
  Promise.all(promises)
    .then(() => {
      res.redirect("/history");
    })
    .catch((err) => {
      console.log(err);
      res.redirect("/history");
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
