import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, User, Phone, Calendar, Globe, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { ImageUpload } from '@/components/ImageUpload';
import { Profile } from '@/types/profile';
import { getInitials } from '@/utils/stringUtils';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
  onProfileUpdate: () => void;
}

interface FormErrors {
  full_name?: string;
  phone_number?: string;
  website_url?: string;
  bio?: string;
}

const PHONE_REGEX = /^(\+?\d{1,4}[\s-]?)?\d{7,15}$/;
const URL_REGEX = /^https?:\/\/.+\..+/;
const BIO_MAX_LENGTH = 200;

const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  isOpen,
  onClose,
  profile,
  onProfileUpdate
}) => {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formData, setFormData] = useState({
    full_name: '',
    phone_number: '',
    date_of_birth: '',
    avatar_url: '',
    bio: '',
    website_url: ''
  });

  // Track initial values for unsaved changes detection
  const initialDataRef = useRef(formData);
  const hasUnsavedChanges = JSON.stringify(formData) !== JSON.stringify(initialDataRef.current);

  useEffect(() => {
    if (profile) {
      const data = {
        full_name: profile.full_name || '',
        phone_number: profile.phone_number || '',
        date_of_birth: profile.date_of_birth || '',
        avatar_url: profile.avatar_url || '',
        bio: profile.bio || '',
        website_url: profile.website_url || ''
      };
      setFormData(data);
      initialDataRef.current = data;
      setErrors({});
    }
  }, [profile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    // Full name validation
    const trimmedName = formData.full_name?.trim();
    if (!trimmedName) {
      newErrors.full_name = 'Full name is required';
    } else if (trimmedName.length < 2) {
      newErrors.full_name = 'Full name must be at least 2 characters';
    } else if (trimmedName.length > 100) {
      newErrors.full_name = 'Full name must be under 100 characters';
    }

    // Phone validation (optional but must be valid if provided)
    if (formData.phone_number?.trim()) {
      const cleanPhone = formData.phone_number.trim().replace(/[\s-]/g, '');
      if (!PHONE_REGEX.test(cleanPhone)) {
        newErrors.phone_number = 'Enter a valid phone number (e.g., +91 9876543210)';
      }
    }

    // Website URL validation (optional but must be valid if provided)
    if (formData.website_url?.trim()) {
      if (!URL_REGEX.test(formData.website_url.trim())) {
        newErrors.website_url = 'Enter a valid URL starting with http:// or https://';
      }
    }

    // Bio validation
    if (formData.bio && formData.bio.length > BIO_MAX_LENGTH) {
      newErrors.bio = `Bio must be under ${BIO_MAX_LENGTH} characters`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (!validateForm()) {
      toast.error('Please fix the errors before saving');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name.trim(),
          phone_number: formData.phone_number.trim() || null,
          date_of_birth: formData.date_of_birth || null,
          avatar_url: formData.avatar_url || null,
          bio: formData.bio.trim() || null,
          website_url: formData.website_url.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', profile.user_id);

      if (error) throw error;

      toast.success('Profile updated successfully');
      onProfileUpdate();
      onClose();
    } catch (error: unknown) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirmed) return;
    }
    onClose();
  }, [hasUnsavedChanges, onClose]);


  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Edit Profile</DialogTitle>
          <DialogDescription>
            Update your personal information and profile details. Click save when you're done.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-full max-w-xs mx-auto">
              <Label className="mb-2 block text-center text-sm font-medium">Profile Picture</Label>
              <ImageUpload
                onImageUploaded={(url) => setFormData(prev => ({ ...prev, avatar_url: url }))}
                currentImage={formData.avatar_url || ''}
                folder="avatars"
                bucket="avatars"
                cropAspectRatio={1}
                placeholder="Upload Avatar"
                className="w-full"
              />
            </div>
          </div>

          {/* Form Fields — Two Column on Desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-sm font-medium">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="full_name"
                  name="full_name"
                  type="text"
                  placeholder="John Doe"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  className={`pl-10 ${errors.full_name ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  required
                  minLength={2}
                  maxLength={100}
                />
              </div>
              {errors.full_name && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />{errors.full_name}
                </p>
              )}
            </div>

            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="phone_number" className="text-sm font-medium">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone_number"
                  name="phone_number"
                  type="tel"
                  placeholder="+91 9876543210"
                  value={formData.phone_number}
                  onChange={handleInputChange}
                  className={`pl-10 ${errors.phone_number ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  maxLength={20}
                />
              </div>
              {errors.phone_number && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />{errors.phone_number}
                </p>
              )}
            </div>

            {/* Date of Birth */}
            <div className="space-y-2">
              <Label htmlFor="date_of_birth" className="text-sm font-medium">Date of Birth</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="date_of_birth"
                  name="date_of_birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={handleInputChange}
                  max={new Date().toISOString().split('T')[0]}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Website URL */}
            <div className="space-y-2">
              <Label htmlFor="website_url" className="text-sm font-medium">Website</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="website_url"
                  name="website_url"
                  type="url"
                  placeholder="https://yourwebsite.com"
                  value={formData.website_url}
                  onChange={handleInputChange}
                  className={`pl-10 ${errors.website_url ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                />
              </div>
              {errors.website_url && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />{errors.website_url}
                </p>
              )}
            </div>
          </div>

          {/* Bio — Full Width */}
          <div className="space-y-2">
            <Label htmlFor="bio" className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Bio
            </Label>
            <Textarea
              id="bio"
              name="bio"
              placeholder="Tell us a little about yourself..."
              value={formData.bio}
              onChange={handleInputChange}
              maxLength={BIO_MAX_LENGTH + 10}
              rows={3}
              className={`resize-none ${errors.bio ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            />
            <div className="flex justify-between items-center">
              {errors.bio ? (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />{errors.bio}
                </p>
              ) : (
                <span />
              )}
              <p className={`text-xs ${formData.bio.length > BIO_MAX_LENGTH ? 'text-destructive' : 'text-muted-foreground'}`}>
                {formData.bio.length}/{BIO_MAX_LENGTH}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              {hasUnsavedChanges && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Unsaved changes
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || uploading}
                className="min-w-[120px] bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileEditModal;
