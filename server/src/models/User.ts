import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser } from '../types/index.js';

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Nome é obrigatório'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email é obrigatório'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Senha é obrigatória'],
      minlength: [6, 'Senha deve ter pelo menos 6 caracteres'],
    },
    profile: {
      type: String,
      enum: ['admin', 'usuario'],
      default: 'usuario',
    },
    functions: {
      type: [String],
      default: [],
    },
    teams: [{
      type: Schema.Types.ObjectId,
      ref: 'Team',
    }],
    hasAgenda: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
    },
    mustChangePassword: {
      type: Boolean,
      default: true,  // Novos usuários devem trocar a senha no primeiro login
    },
    googleId: {
      type: String,
      sparse: true,
    },
    microsoftId: {
      type: String,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Index for efficient queries (email já tem índice via unique: true)
userSchema.index({ profile: 1 });
userSchema.index({ active: 1 });

const User = mongoose.model<IUser>('User', userSchema);

export default User;
