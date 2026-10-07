import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';

@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value) || !isValidObjectId(value)) {
      throw new BadRequestException('Invalid id');
    }
    return value;
  }
}
