import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));

const storage = multer.diskStorage({

  destination : function (req , file , cb){
    const chatType = req.body.chatType=== 'private'? 'private' : 'general';
    cb(null, path.join(__dirname, '..', 'uploads', chatType));
  },

  filename: function (req , file , cb){
    cb(null , Date.now() + '-' + file.originalname);
  }

}) ;

const upload = multer({storage});



router.post('/', upload.single('file') , (req , res) =>{

  try {
    if (!req.session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const { filename, mimetype } = req.file;
    res.json({
      success: true,
      filename,
      type: mimetype,
      fileURL: `/uploads/${req.body.chatType}/${filename}`
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Error in multer middleware' });
  }

});



export default router