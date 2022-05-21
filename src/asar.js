import asar from 'asar'

const src = 'some/path/';
const dest = 'name.asar';


export default (input, output) => asar.createPackage(src, dest);
