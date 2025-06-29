import { BankOfAmericaLogo } from './bankLogos/BankOfAmerica.logo';
import { PlaceHolderLogo } from './bankLogos/BankPlaceHolder.logo';
import { ChaseLogo } from './bankLogos/Chase.logo';

interface BankImageMap {
  [key: string]: string;
}

const bankImageMapper: BankImageMap = {
  'Bank of America': BankOfAmericaLogo,
  Chase: ChaseLogo,
};

export function getBankImageUrl(bankName: string): string | null {
  return bankImageMapper[bankName] || PlaceHolderLogo;
}
