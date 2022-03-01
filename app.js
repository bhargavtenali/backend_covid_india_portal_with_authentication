const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

convertDbArrayToResponseObj = (array) => {
  return array.map((eachItem) => {
    return {
      stateId: eachItem.state_id,
      stateName: eachItem.state_name,
      population: eachItem.population,
    };
  });
};
convertDbObjToResponseObj = (item) => {
  return {
    stateId: item.state_id,
    stateName: item.state_name,
    population: item.population,
  };
};
convertDbObjToResponseObjDistrict = (item) => {
  return {
    districtId: item.district_id,
    districtName: item.district_name,
    stateId: item.state_id,
    cases: item.cases,
    cured: item.cured,
    active: item.active,
    deaths: item.deaths,
  };
};
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//login User
app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//GET state names
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesArray = `
    SELECT
      *
    FROM
      state
    ORDER BY
      state_id;`;
  const statesArray = await db.all(getStatesArray);
  response.send(convertDbArrayToResponseObj(statesArray));
});

//GET Specific State
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
    SELECT
      *
    FROM
      state
    WHERE
      state_id = ${stateId};`;
  const state = await db.get(getStateQuery);
  response.send(convertDbObjToResponseObj(state));
});
// add District
app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const addDistrictQuery = `
    INSERT INTO
      district (district_name,
    state_id,
    cases,
    cured,
    active,
    deaths)
    VALUES
      (
          '${districtName}',
          ${stateId},
          ${cases},
          ${cured},
          ${active},
          ${deaths}
      );`;

  const dbResponse = await db.run(addDistrictQuery);
  //   const bookId = dbResponse.lastID;
  response.send("District Successfully Added");
});

//GET Specific District
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    //   console.log(districtId);
    const getDistrictQuery = `
    SELECT
      *
    FROM
      district
    WHERE
      district_id = ${districtId};`;
    const district = await db.get(getDistrictQuery);
    response.send(convertDbObjToResponseObjDistrict(district));
  }
);

// Delete District
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE FROM
      district
    WHERE
      district_id = ${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

// Update District
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updateDistrictQuery = `
    UPDATE
      district
    SET
      district_name='${districtName}',
      state_id=${stateId},
      cases=${cases},
      cured=${cured},
      active=${active},
      deaths='${deaths}'
    WHERE
      district_id = ${districtId};`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//GET Specific State Cases
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateCasesQuery = `SELECT SUM(cases) AS totalCases,
  SUM(cured) AS totalCured,
  SUM(active) AS totalActive,
  SUM(deaths) AS totalDeaths
  FROM district WHERE state_id = ${stateId}`;
    const stateCases = await db.get(getStateCasesQuery);
    response.send(stateCases);
  }
);

//GET Specific District State
app.get(
  "/districts/:districtId/details/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    //   console.log(districtId);
    const getDistrictDetailsQuery = `
    SELECT
      state.state_name AS stateName
    FROM
      district
      INNER JOIN state ON district.state_id = state.state_id
    WHERE
      district.district_id = ${districtId};`;
    const districtDetails = await db.get(getDistrictDetailsQuery);
    response.send(districtDetails);
  }
);

module.exports = app;
