import { getAllParkingLots, sendTokenAuthority, TryCatch } from "../utils/features.js";
import {ErrorHandler} from "../utils/Utility.js"
import { ValidateUser } from "../utils/validation.js";
import  {RegAuthority} from "../Models/RegAuthority.Model.js"
import { compare } from "bcrypt";
import { cookieOptions } from "../utils/features.js";
import { ParkingLot } from "../Models/ParkingLot.Model.js";
import { Slot } from "../Models/Slot.Model.js";
import { AdminKey } from "../server.js";


const Register=TryCatch (async (req,res,next)=>{
  console.log("recieved");
    const {name,address,contactnumber,email,dob,username,password,adminkey}=req.body;

    const fields = {
        name,
        address,
        contactnumber,
        email,
        dob,
        username,
        password,
        adminkey
      };

        for(let key in fields){
        const value=fields[key];
        const result=ValidateUser(value,key);
        // console.log(result);
        if(result?.valid==false){
            // console.log(result)
            return next(new ErrorHandler(result.message,404));
        }
      }

      if(adminkey!==AdminKey){
        return next (new ErrorHandler("Admin Key does not match",400));
      }

    const auth=await RegAuthority.create(fields);

    return res.status(200).json({
        success:true,
        message:"RegAuthority Created Succesfully"
    })
})

const login=TryCatch (async (req,res,next)=>{
  const {username,password,adminkey}=req.body;
  if(!username || username.trim()=="" ){
    return next(new ErrorHandler("username can not be empty",400));
  }
  if(!password || password.trim()==""){
    return next(new ErrorHandler("password can not be empty",400));
  }
  if(!adminkey || adminkey.trim()==""){
    return next(new ErrorHandler("adminKey can not be empty",400));
  }

  if(adminkey!==AdminKey){
    return next(new ErrorHandler("Admin Key Value is wrong",404));
  }

  const auth=await RegAuthority.findOne({username}).select("+password");

  if(!auth){
    return next(new ErrorHandler("Invalid username or password",401));
  }

  const isMatch = await compare(password, auth.password);


  if(!isMatch){
    return next(new ErrorHandler("Invalid username or password",401));
  }

  sendTokenAuthority(res,auth,200,`Welcome Back ${auth.name}`)
})


const logout=TryCatch( async (req,res,next)=>{
  res.status(200).cookie("ParkingSystemAuthority","",{...cookieOptions,maxAge:0}).json({
    success:true,
    message :"logout success and cookie also deleted"
})

})

const getDetails =TryCatch( async(req,res,next)=>{
  const user=await RegAuthority.findById(req.authority);
  return res.status(200).json({
    success:true,
    user
  })
})

const getParkingLots=TryCatch(async (req,res,next)=>{
  const parkinglots=await getAllParkingLots();
  return res.status(200).json({
    success:true,
    parkinglots
  })
})

const updateParkingLot=TryCatch(async (req,res,next)=>{
  const { city, location, numberofslots, _id } = req.body;

  // Validate the input
  if (!_id || !city || !location ) {
    return res.status(400).json({
      success: false,
      message: 'Missing or invalid fields in the request body.',
    });
  }

  // Find the parking lot by its ID
  const parkingLot = await ParkingLot.findById(_id);
  if (!parkingLot) {
    return res.status(404).json({
      success: false,
      message: 'Parking lot not found.',
    });
  }

  // Update the parking lot details (city, location, number of slots)
  parkingLot.city = city || parkingLot.city;
  parkingLot.location = location || parkingLot.location;
  
  // If the number of slots is being updated
  if (numberofslots !== parkingLot.numberofslots) {
    const currentSlots = parkingLot.slots.length;

    // If new slots number is greater than current slots
    if (numberofslots > currentSlots) {
      const newSlotsCount = numberofslots - currentSlots;
      const newSlots = [];
      for (let i = 0; i < newSlotsCount; i++) {
        const slot = new Slot({
          status: 'available',
          parkingLot: parkingLot._id,
        });
        newSlots.push(slot.save());
      }
      const addedSlots = await Promise.all(newSlots);
      parkingLot.slots.push(...addedSlots.map(slot => slot._id)); // Add new slots to the parking lot
    }

    // If new slots number is less than current slots
    if (numberofslots < currentSlots) {
      const removedSlots = parkingLot.slots.slice(numberofslots);
      await Slot.deleteMany({ _id: { $in: removedSlots } }); // Remove the extra slots
      parkingLot.slots = parkingLot.slots.slice(0, numberofslots); // Keep the required number of slots
    }

    parkingLot.numberofslots = numberofslots; // Update the number of slots
  }

  // Save the updated parking lot
  await parkingLot.save();

  res.status(200).json({
    success: true,
    message: 'Parking lot updated successfully.',
    parkingLot,
  });

})

const AddNewParkingLot=TryCatch( async(req,res,next)=>{

  const parkingLotCollection = ParkingLot.collection;

    // Drop the unique index on "location" (if it exists)
    await parkingLotCollection.dropIndex("location_1");

    // Create a non-unique index on the "location" field
    await parkingLotCollection.createIndex({ location: 1 }); 

  const {city,location,numberofslots}=req.body;

  const parkingLot = new ParkingLot({
    city,
    location,
    numberofslots,
  });
  
  await parkingLot.save();

  const slotPromises = [];
  for (let i = 0; i < parkingLot.numberofslots; i++) {
    const slot = new Slot({
      status: 'available',
      parkingLot: parkingLot._id,
    });

    slotPromises.push(slot.save());
  }

  const slots = await Promise.all(slotPromises);

  parkingLot.slots = slots.map(slot => slot._id);
  await parkingLot.save();

  res.status(200).json({
    success:true,
    message:"Parking Slot created Succefully"
  })
})

export {Register,login,logout,getDetails,getParkingLots,AddNewParkingLot,updateParkingLot}