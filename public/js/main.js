// Initialize Firebase (ADD YOUR OWN DATA)
const firebaseConfig = {
    apiKey: "AIzaSyDju9VcaNmE8OHWGIBDiKiPH4LHS1-ANDg",
    authDomain: "test-5a353.firebaseapp.com",
    databaseURL: "https://test-5a353-default-rtdb.firebaseio.com",
    projectId: "test-5a353",
    storageBucket: "test-5a353.appspot.com",
    messagingSenderId: "119664388910",
    appId: "1:119664388910:web:45f7002b32c436a14768bf",
    measurementId: "G-TY5VTYP1QD"
        
  
    };
  
  firebase.initializeApp(firebaseConfig);
  
  // Reference messages collection
  var messagesRef = firebase.database().ref('messages');
  
  // Listen for form submit
  document.getElementById('contactForm').addEventListener('submit', submitForm);
  
  // Submit form
  function submitForm(e){
    e.preventDefault();
  
    // Get values
    var name = getInputVal('name');
    // var company = getInputVal('company');
    // var email = getInputVal('email');
     var phone = getInputVal('phone');
    // var message = getInputVal('message');
  
    // Save message
    saveMessage(phone);
  
    saveMessage1(name);
    console.log(name);
  
    // Show alert
    document.querySelector('.alert').style.display = 'block';
  
    // Hide alert after 3 seconds
    setTimeout(function(){
      document.querySelector('.alert').style.display = 'none';
    },3000);
  
    // Clear form
    document.getElementById('contactForm').reset();
  }
  
  // Function to get get form values
  function getInputVal(id){
    return document.getElementById(id).value;
  }
  
  // Save message to firebase
  function saveMessage(phone){
  //   var newMessageRef = messagesRef.push();
  //   newMessageRef.set({
  //     // name: name,
  //     // company:company,
  //     // email:email,
  //     phone:phone,
  // //    message:message
  //   });
  var newMessageRef = messagesRef.child('list').orderByKey().limitToLast(1);
    newMessageRef.once('value', function(snapshot) {
      var previousMessage = snapshot.val();
      messagesRef.child('list').update({
              phone: phone
      });
    });
  }
  function saveMessage1(name){
    //   var newMessageRef = messagesRef.push();
    //   newMessageRef.set({
    //     // name: name,
    //     // company:company,
    //     // email:email,
    //     phone:phone,
    // //    message:message
    //   });
    var newMessageRef = messagesRef.child('list').orderByKey().limitToLast(1);
      newMessageRef.once('value', function(snapshot) {
        var previousMessage = snapshot.val();
        messagesRef.child('list').update({
                name: name
        });
      });
    }