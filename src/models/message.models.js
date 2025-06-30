import mongoose, { Schema } from "mongoose";

const messageSchema = new Schema({

    content: {
        type: String,
        required: true
    },
    client_offset:{
        type: String,
        required : true,
        unique: true
    },
    senderUsername:{
        type: String,
        required : true
    },
    recipientUsername : {
        type : String
    },

},
    { timestamps: true }
)

export const Message = mongoose.model("Message" , messageSchema);