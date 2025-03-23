const properties = require("./json/properties.json");
const users = require("./json/users.json");


const { Pool } = require("pg");

const pool = new Pool({
  user: "development",
  password: "development",
  host: "localhost",
  database: "lightbnb",
});

// the following assumes that you named your connection variable `pool`
pool.query(`SELECT title FROM properties LIMIT 10;`).then(response => {

});

/// Users
//-----------------------------------------------------------------------------
/**
 * Get a single user from the database given their email.
 * @param {String} email The email of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithEmail = function(email) {
  return pool
    .query(`SELECT * FROM users WHERE email = $1;`, [email.toLowerCase()])
    .then((res) => {
      return res.rows[0] || null;
    })
    .catch((err) => {
      console.error('Error fetching user email:', err);
      return null;
    });
};
// Original code
// let resolvedUser = null;
// for (const userId in users) {
//   const user = users[userId];
//   if (user && user.email.toLowerCase() === email.toLowerCase()) {
//     resolvedUser = user;
//   }
// }
// return Promise.resolve(resolvedUser);
//-----------------------------------------------------------------------------
/**
 * Get a single user from the database given their id.
 * @param {string} id The id of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithId = function(id) {
  return pool
    .query(`SELECT * FROM users WHERE id = $1;`, [id])
    .then((res) => {
      return res.rows[0] || null;
    })
    .catch((err) => {
      console.error("Error fetching user by id:", err);
      return null;
    });
};


// Original code
// return Promise.resolve(users[id]);

//-----------------------------------------------------------------------------
/**
 * Add a new user to the database.
 * @param {{name: string, password: string, email: string}} user
 * @return {Promise<{}>} A promise to the user.
 */
const addUser = function(user) {
  return pool
    .query(`INSERT INTO users(name, email, password) VALUES ($1, $2, $3) RETURNING *;`, [user.name, user.email, user.password])
    .then((res) => {
      return res.rows[0];
    })
    .catch((err) => {
      console.error(`There was an error adding user:`, err);
      return null;
    });
};



// Original code
// const userId = Object.keys(users).length + 1;
// user.id = userId;
// users[userId] = user;
// return Promise.resolve(user);

//-----------------------------------------------------------------------------
/// Reservations

/**
 * Get all reservations for a single user.
 * @param {string} guest_id The id of the user.
 * @return {Promise<[{}]>} A promise to the reservations.
 */
const getAllReservations = function(guest_id, limit = 10) {
  return pool
    .query(
      `SELECT reservations.id, properties.title, properties.cost_per_night, reservations.start_date, avg(property_reviews.rating) as average_rating
       FROM reservations
       JOIN properties ON reservations.property_id = properties.id
       JOIN property_reviews ON properties.id = property_reviews.property_id
       WHERE reservations.guest_id = $1
       GROUP BY properties.id, reservations.id
       ORDER BY reservations.start_date
       LIMIT $2;
      `, [guest_id, limit]
    )
    .then((res) => res.rows)
    .catch((err) => {
      console.error("There was an error while fetching reservations:", err);
      return [];
    });
};
//-----------------------------------------------------------------------------
/// Properties

/**
 * Get all properties.
 * @param {{}} options An object containing query options.
 * @param {*} limit The number of results to return.
 * @return {Promise<[{}]>}  A promise to the properties.
 */
const getAllProperties = function(options, limit = 10) {
  // 1
  const queryParams = [];
  const whereClauses = [];
  // 2
  let queryString = `
  SELECT properties.*, avg(property_reviews.rating) AS average_rating
  FROM properties
  LEFT JOIN property_reviews ON properties.id = property_reviews.property_id
  `;

  // 3
  if (options.city) {
    queryParams.push(`%${options.city}%`);
    whereClauses.push(`city LIKE $${queryParams.length}`);
  }

  // if owner_id is passed in, will only return properties belonging to that owner
  if (options.owner_id) {
    queryParams.push(options.owner_id);
    whereClauses.push(`owner_id = $${queryParams.length}`);
  }

  // filtering by min and max price if it's provided
  if (options.minimum_price_per_night) {
    queryParams.push(options.minimum_price_per_night * 100);
    whereClauses.push(`cost_per_night >= $${queryParams.length}`);
  }

  if (options.maximum_price_per_night) {
    queryParams.push(options.maximum_price_per_night * 100);
    whereClauses.push(`cost_per_night <= $${queryParams.length}`);
  }

  // adds the where clause if any filters exist
  if (whereClauses.length > 0) {
    queryString += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  // group and order results
  queryString += ` GROUP BY properties.id`;


  // filtering by min rating if passed in and returns properties with an avg rating equal to or higher than that

  if (options.minimum_rating) {
    queryParams.push(options.minimum_rating);
    queryString += ` HAVING avg(property_reviews.rating) >= $${queryParams.length}`;
  }

  // 4
  queryParams.push(limit);
  queryString += `
  ORDER BY cost_per_night
  LIMIT $${queryParams.length};
  `;

  // debugging code (REMOVE LATER)
  console.log(queryString, queryParams);

  // 6
  return pool.query(queryString, queryParams)
    .then((res) => {
      return res.rows;
    })
    .catch((err) => {
      console.log(err.message);
      return Promise.reject(err)
    }) 
};
//-----------------------------------------------------------------------------
/**
 * Add a property to the database
 * @param {{}} property An object containing all of the property details.
 * @return {Promise<{}>} A promise to the property.
 */
const addProperty = function(property) {
  const propertyId = Object.keys(properties).length + 1;
  property.id = propertyId;
  properties[propertyId] = property;
  return Promise.resolve(property);
};

module.exports = {
  getUserWithEmail,
  getUserWithId,
  addUser,
  getAllReservations,
  getAllProperties,
  addProperty,
  pool
};
