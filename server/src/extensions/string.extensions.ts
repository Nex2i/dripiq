// string.extensions.ts

// eslint-disable-next-line
interface String {
  isValidEmail(): boolean;
  isNullOrEmpty(): boolean;
}

String.prototype.isValidEmail = function (): boolean {
  if (this.isNullOrEmpty()) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(this.toString());
};

String.prototype.isNullOrEmpty = function (): boolean {
  return (
    this == null || this.trim() == '' || this.toString() == null || this.toString().trim() === ''
  );
};
