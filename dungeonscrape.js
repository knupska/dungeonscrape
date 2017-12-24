/**
 * Scraper to locate discounted boardgames on dungeoncrawl.com.au
 *
 * Ported from the original Python version by 'boardgamegeek.com/user/srand'
 * https://pastebin.com/BRic3Vgy
 */

// includes node-fetch for the retrieval of pages
const fetch = require( 'node-fetch' );

// includes jssoup to parse the retrieved pages
const JSSoup = require('jssoup').default;

// includes lodash to simplify the discount/price sort
const _ = require( 'lodash' );

// includes fs to write the output as json/txt files
const fs = require( 'fs' );

// includes html-entities to decode html entities in the result
const Entities = require( 'html-entities' ).AllHtmlEntities;
const entities = new Entities();

// initalises the result array
let items = [];

// sets the initial index
// this should be 1 less than whatever page you want to start on
let index = 0;

// starts processing by getting the first page
scrape();

/**
 * Retrieves a page from the remote source
 * and makes the body available for further parsing
 */
function scrape() {

  // increments the index
  index += 1;

  // fetches the remote page
  // and triggers 'parse' on the resulting body
  console.log( 'Scrape - page: ' + index );
  fetch( 'https://www.dungeoncrawl.com.au/board-games/?sortby=lowest_price&pgnum=' + index )
    .then( res => {
      return res.text();
    } )
    .then( body => {
      parse( body );
    } );

}

/**
 * Parses the page body into a simple object
 * Continues to call 'scrape' while there are still products available
 */
function parse( body ) {

  console.log( 'Parse - page: ' + index );

  // turns the body into soup
  let soup = new JSSoup( body );

  // locates all the products
  let products = soup.findAll( 'div', { itemtype: 'http://schema.org/Product' } );

  // assumes we're complete if no products were located
  let complete = ( products.length == 0 );

  // performs further processing only if products were located
  if ( !complete ) {

    // loops through the products on this page
    products.some( product => {

      // due to the way dungeoncrawl lists 'out of stock' products after 'in stock'
      // this assumes the scrape is 'complete' as soon as it locates a single oos product
      let oos = product.find( 'a', { title: 'Notify Me When Back In Stock' } );
      if ( oos )  {
        complete = true;
        return true;
      }

      // extracts the relevant values from the product
      let link = product.find( 'h3' ).find( 'a' );
      let price = product.find( 'span', { itemprop: 'price' } ).text.replace( /[^0-9.]+/g, '' );
      let discountDiv = product.find( 'div', { class: 'savings-container' } ).find( 'span' );
      let discount = ( discountDiv ) ? discountDiv.text.replace( /[^0-9.]+/g, '' ) : 0;

      // stores the located values as a simple object for later use
      items.push(
        {
          name: link.attrs.title,
          href: link.attrs.href,
          price: parseFloat( price ),
          discount: parseFloat( discount )
        }
      );

    } );

  }

  // outputs the final result once 'complete'
  if ( complete ) {
    output();

  // continues the scrape when there is more data available
  } else {
    scrape();

  }

}

/**
 * Outputs the processed data in various formats
 */
function output() {

  // outputs a json file
  // this does not include $ and % signs to make it easier to process elsewhere
  console.log( 'Output - results.json file...' );
  items = _.orderBy( items, [ 'discount', 'price'], [ 'desc', 'asc' ] );
  fs.writeFileSync( 'results.json', JSON.stringify( items ), 'utf-8' );

  // outputs a txt file
  // this includes $ and % signs to make it easier to read
  console.log( 'Output - results.txt file...' );
  let itemsText = items.map( item => { return `${ item.name }\t${ item.href }\t$${ item.price }\t${ item.discount }%`; } );
  fs.writeFileSync( 'results.txt', entities.decode( itemsText.join( '\n' ) ), 'utf-8' );

  // outputs that we're all done
  console.log( 'Output - finished' );

}

